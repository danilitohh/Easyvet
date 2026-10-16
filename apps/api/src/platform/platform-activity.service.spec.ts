import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { UsersService } from '../users/users.service';
import { PlatformService } from './platform.service';

describe('PlatformService activity', () => {
  const count = jest.fn<(args: unknown) => Promise<number>>();
  const findMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const prisma = {
    platformAuditEvent: { count, findMany },
  } as unknown as PrismaService;
  const service = new PlatformService(prisma, {} as UsersService, {} as PasswordService);

  beforeEach(() => {
    jest.clearAllMocks();
    count.mockResolvedValue(21);
    findMany.mockResolvedValue([
      {
        id: '4a86a228-d9f5-4672-a566-47ad8d5355f5',
        action: 'ORGANIZATION_STATUS_CHANGED',
        metadata: { from: 'ACTIVE', to: 'SUSPENDED', reason: 'Revisión de soporte' },
        createdAt: new Date('2026-10-15T14:00:00.000Z'),
        actor: { email: 'admin@easyvet.co' },
        organization: { name: 'Clínica Central' },
      },
    ]);
  });

  it('applies the same filters to count and results with bounded server pagination', async () => {
    const result = await service.activity({
      search: 'central',
      action: 'ORGANIZATION_STATUS_CHANGED',
      from: '2026-10-01',
      to: '2026-10-15',
      page: 2,
      pageSize: 10,
    });

    const where = {
      action: 'ORGANIZATION_STATUS_CHANGED',
      OR: [
        { actor: { email: { contains: 'central', mode: 'insensitive' } } },
        { organization: { name: { contains: 'central', mode: 'insensitive' } } },
      ],
      createdAt: {
        gte: new Date('2026-10-01T05:00:00.000Z'),
        lt: new Date('2026-10-16T05:00:00.000Z'),
      },
    };
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 10, take: 10, orderBy: { createdAt: 'desc' } }),
    );
    expect(result).toMatchObject({ total: 21, page: 2, pageSize: 10, pageCount: 3 });
    expect(result.data[0]).toMatchObject({ actorEmail: 'admin@easyvet.co' });
  });

  it('rejects an inverted date range before querying the database', async () => {
    await expect(
      service.activity({
        action: 'ORGANIZATION_STATUS_CHANGED',
        from: '2026-10-20',
        to: '2026-10-01',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
