import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PlatformRole, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { UsersService } from '../users/users.service';
import { PlatformService } from './platform.service';

describe('PlatformService platform accounts', () => {
  const actorId = '1420dc8d-cc6d-4509-ae6b-611a667cb267';
  const targetId = 'c2d02a42-e03a-4f78-99e9-78186c2a7851';
  const createdAt = new Date('2026-10-15T10:00:00.000Z');
  const normalizeEmail = jest.fn((email: string) => email.trim().toLowerCase());
  const hash = jest.fn(async () => 'argon-hash');
  const count = jest.fn<(...args: never[]) => Promise<number>>();
  const findMany = jest.fn<(...args: never[]) => Promise<unknown[]>>();
  const createMany = jest.fn<(...args: never[]) => Promise<{ count: number }>>();
  const findUnique = jest.fn<(...args: never[]) => Promise<unknown>>();
  const findUniqueOrThrow = jest.fn<(...args: never[]) => Promise<unknown>>();
  const update = jest.fn<(...args: never[]) => Promise<unknown>>();
  const sessionUpdateMany = jest.fn<(...args: never[]) => Promise<{ count: number }>>();
  const auditCreate = jest.fn<(...args: never[]) => Promise<unknown>>();
  const queryRaw = jest.fn<(...args: never[]) => Promise<unknown>>();
  const tx = {
    user: { count, findMany, createMany, findUnique, findUniqueOrThrow, update },
    session: { updateMany: sessionUpdateMany },
    platformAuditEvent: { create: auditCreate },
    $queryRaw: queryRaw,
  };
  const transaction = jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
    callback(tx),
  );
  const prisma = {
    user: { count, findMany },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new PlatformService(
    prisma,
    { normalizeEmail } as unknown as UsersService,
    { hash } as unknown as PasswordService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    normalizeEmail.mockImplementation((email) => email.trim().toLowerCase());
    hash.mockResolvedValue('argon-hash');
    queryRaw.mockResolvedValue([]);
    auditCreate.mockResolvedValue({ id: 'audit-id' });
  });

  it('lists only platform administrators with safe account metadata', async () => {
    findMany.mockResolvedValue([
      {
        id: targetId,
        email: 'admin@easyvet.co',
        status: UserStatus.ACTIVE,
        createdAt,
      },
    ]);
    count.mockResolvedValue(1);

    await expect(service.platformAccounts({})).resolves.toMatchObject({
      data: [{ id: targetId, email: 'admin@easyvet.co', status: 'ACTIVE' }],
      total: 1,
      limit: 100,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { platformRole: PlatformRole.PLATFORM_ADMIN },
        select: { id: true, email: true, status: true, createdAt: true },
      }),
    );
  });

  it('creates an isolated platform admin and audits without storing the temporary password', async () => {
    createMany.mockResolvedValue({ count: 1 });
    findUniqueOrThrow.mockResolvedValue({
      id: targetId,
      email: 'new-admin@easyvet.co',
      status: UserStatus.ACTIVE,
      createdAt,
    });

    const result = await service.createPlatformAccount(actorId, {
      email: ' New-Admin@Easyvet.co ',
      reason: 'Nueva integrante del equipo',
    });

    expect(result.temporaryPassword).toHaveLength(22);
    expect(hash).toHaveBeenCalledWith(result.temporaryPassword);
    expect(createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new-admin@easyvet.co',
        passwordHash: 'argon-hash',
        status: UserStatus.ACTIVE,
        platformRole: PlatformRole.PLATFORM_ADMIN,
        mustChangePassword: true,
      }),
      skipDuplicates: true,
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorUserId: actorId,
        action: 'PLATFORM_ADMIN_ACCOUNT_CREATED',
        metadata: {
          email: 'new-admin@easyvet.co',
          reason: 'Nueva integrante del equipo',
          mustChangePassword: true,
        },
      },
    });
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain(result.temporaryPassword);
  });

  it('does not promote an existing account when an email conflicts', async () => {
    createMany.mockResolvedValue({ count: 0 });

    await expect(
      service.createPlatformAccount(actorId, {
        email: 'clinic-user@easyvet.co',
        reason: 'Nueva integrante del equipo',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('suspends an admin, revokes open sessions and audits the reason atomically', async () => {
    findUnique.mockResolvedValue({
      id: targetId,
      email: 'admin@easyvet.co',
      status: UserStatus.ACTIVE,
      platformRole: PlatformRole.PLATFORM_ADMIN,
      createdAt,
    });
    count.mockResolvedValue(2);
    update.mockResolvedValue({
      id: targetId,
      email: 'admin@easyvet.co',
      status: UserStatus.SUSPENDED,
      createdAt,
    });
    sessionUpdateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.updatePlatformAccountStatus(actorId, targetId, {
        status: UserStatus.SUSPENDED,
        reason: 'Acceso temporalmente suspendido',
      }),
    ).resolves.toMatchObject({ status: 'SUSPENDED', email: 'admin@easyvet.co' });

    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: targetId, revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date), activeMembershipId: null }),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: actorId,
        action: 'PLATFORM_ADMIN_ACCOUNT_STATUS_CHANGED',
        metadata: expect.objectContaining({
          email: 'admin@easyvet.co',
          from: 'ACTIVE',
          to: 'SUSPENDED',
          reason: 'Acceso temporalmente suspendido',
        }),
      }),
    });
  });

  it('protects the last active platform administrator', async () => {
    findUnique.mockResolvedValue({
      id: targetId,
      email: 'admin@easyvet.co',
      status: UserStatus.ACTIVE,
      platformRole: PlatformRole.PLATFORM_ADMIN,
      createdAt,
    });
    count.mockResolvedValue(1);

    await expect(
      service.updatePlatformAccountStatus(actorId, targetId, {
        status: UserStatus.SUSPENDED,
        reason: 'Cierre de cuenta solicitado',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('does not let an administrator suspend their own access', async () => {
    await expect(
      service.updatePlatformAccountStatus(actorId, actorId, {
        status: UserStatus.SUSPENDED,
        reason: 'Desactivar mi cuenta',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
