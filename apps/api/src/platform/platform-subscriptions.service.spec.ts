import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { UsersService } from '../users/users.service';
import { PlatformService } from './platform.service';

describe('PlatformService subscriptions', () => {
  const organizationId = 'c2d02a42-e03a-4f78-99e9-78186c2a7851';
  const actorUserId = '1420dc8d-cc6d-4509-ae6b-611a667cb267';
  const plan = { id: '7a9e751a-3238-40d8-9318-9a7cfb8bcf37', code: 'GROWTH', name: 'Crecimiento' };
  const organizationFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
  const organizationCount = jest.fn<(args: unknown) => Promise<number>>();
  const organizationFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const planFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
  const subscriptionFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
  const subscriptionUpsert = jest.fn<(args: unknown) => Promise<unknown>>();
  const auditCreate = jest.fn<(args: unknown) => Promise<unknown>>();
  const tx = {
    organizationSubscription: {
      findUnique: subscriptionFindUnique,
      upsert: subscriptionUpsert,
    },
    platformAuditEvent: { create: auditCreate },
  };
  const transaction = jest.fn((callback: (client: typeof tx) => unknown) => callback(tx));
  const prisma = {
    organization: {
      findUnique: organizationFindUnique,
      count: organizationCount,
      findMany: organizationFindMany,
    },
    subscriptionPlan: { findUnique: planFindUnique },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new PlatformService(prisma, {} as UsersService, {} as PasswordService);

  beforeEach(() => {
    jest.clearAllMocks();
    organizationFindUnique.mockResolvedValue({ id: organizationId, name: 'Clínica Central' });
    organizationCount.mockResolvedValue(45);
    organizationFindMany.mockResolvedValue([]);
    planFindUnique.mockResolvedValue(plan);
    subscriptionFindUnique.mockResolvedValue(null);
    subscriptionUpsert.mockResolvedValue({
      id: 'db9396a8-f59e-4be8-bf3e-8aa55c5b3525',
      status: 'TRIAL',
      interval: 'ANNUAL',
      startsAt: new Date('2026-10-15T00:00:00.000Z'),
      trialEndsAt: new Date('2026-11-15T00:00:00.000Z'),
      endsAt: null,
      plan,
    });
    auditCreate.mockResolvedValue({ id: 'f5e9db99-9d83-462a-bf02-95c5e66ade6e' });
  });

  it('paginates subscription management organizations in the database', async () => {
    const organization = {
      id: organizationId,
      name: 'Clínica Central',
      slug: 'clinica-central',
      status: 'ACTIVE',
      subscription: null,
    };
    organizationFindMany.mockResolvedValue([organization]);

    await expect(
      service.subscriptions({ search: 'central', page: 2, pageSize: 20 }),
    ).resolves.toEqual({
      data: [
        {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          organizationStatus: organization.status,
          subscription: null,
        },
      ],
      total: 45,
      page: 2,
      pageSize: 20,
    });

    expect(organizationCount).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: 'central', mode: 'insensitive' } },
          { slug: { contains: 'central', mode: 'insensitive' } },
        ],
      },
    });
    expect(organizationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
      }),
    );
  });

  it('assigns the selected plan and records the change and reason atomically', async () => {
    await expect(
      service.assignSubscription(organizationId, actorUserId, {
        planCode: 'GROWTH',
        status: 'TRIAL',
        interval: 'ANNUAL',
        startsAt: '2026-10-15',
        trialEndsAt: '2026-11-15',
        reason: 'Prueba acordada con la clínica',
      }),
    ).resolves.toMatchObject({
      organization: { id: organizationId, name: 'Clínica Central' },
      plan: { code: 'GROWTH', name: 'Crecimiento' },
      status: 'TRIAL',
      interval: 'ANNUAL',
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(subscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
        create: expect.objectContaining({ organizationId, planId: plan.id, status: 'TRIAL' }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId,
          organizationId,
          action: 'ORGANIZATION_SUBSCRIPTION_CHANGED',
          metadata: expect.objectContaining({ reason: 'Prueba acordada con la clínica' }),
        }),
      }),
    );
  });

  it('rejects trial assignments without an end date before opening a transaction', async () => {
    await expect(
      service.assignSubscription(organizationId, actorUserId, {
        planCode: 'GROWTH',
        status: 'TRIAL',
        interval: 'MONTHLY',
        reason: 'Prueba aprobada',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not allow a paid billing interval on the free Esencial plan', async () => {
    planFindUnique.mockResolvedValue({ ...plan, code: 'ESSENTIAL', name: 'Esencial' });

    await expect(
      service.assignSubscription(organizationId, actorUserId, {
        planCode: 'ESSENTIAL',
        status: 'ACTIVE',
        interval: 'MONTHLY',
        reason: 'Asignación del plan gratuito',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
