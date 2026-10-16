import { ConfigService } from '@nestjs/config';
import { PlatformRole, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Environment } from '../config/env';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { PlatformAdminBootstrapService } from './platform-admin-bootstrap.service';

describe('PlatformAdminBootstrapService', () => {
  const secret = 'a-very-long-one-time-bootstrap-secret-for-tests';
  const tx = {
    $queryRaw: jest.fn<() => Promise<Array<{ acquired: number }>>>(),
    user: {
      count: jest.fn<(args: unknown) => Promise<number>>(),
      findUnique: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
      create: jest.fn<(args: unknown) => Promise<{ id: string; email: string }>>(),
    },
    platformAuditEvent: { create: jest.fn<(args: unknown) => Promise<{ id: string }>>() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const users = {
    normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
  } as unknown as UsersService;
  const passwords = {
    hash: jest.fn<() => Promise<string>>().mockResolvedValue('argon-hash'),
  } as unknown as PasswordService;
  const config = {
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService<Environment, true>;
  const service = new PlatformAdminBootstrapService(prisma, users, passwords, config);

  beforeEach(() => {
    jest.clearAllMocks();
    (config.get as jest.Mock).mockReturnValue(secret);
    tx.user.count.mockResolvedValue(0);
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: 'user-id', email: 'admin@easyvet.co' });
    tx.platformAuditEvent.create.mockResolvedValue({ id: 'audit-id' });
  });

  it('creates the first active platform administrator without a clinic membership', async () => {
    await expect(
      service.createFirstAdmin({
        email: ' Admin@Easyvet.co ',
        password: 'a-secure-password-123',
        bootstrapSecret: secret,
      }),
    ).resolves.toEqual({ success: true });

    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: 'admin@easyvet.co',
        passwordHash: 'argon-hash',
        platformRole: PlatformRole.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true },
    });
    expect(tx.platformAuditEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong setup secret before touching the database', async () => {
    await expect(
      service.createFirstAdmin({
        email: 'admin@easyvet.co',
        password: 'a-secure-password-123',
        bootstrapSecret: 'wrong-secret-that-is-long-enough-to-pass-validation',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create a second platform administrator', async () => {
    tx.user.count.mockResolvedValue(1);
    await expect(
      service.createFirstAdmin({
        email: 'admin@easyvet.co',
        password: 'a-secure-password-123',
        bootstrapSecret: secret,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
