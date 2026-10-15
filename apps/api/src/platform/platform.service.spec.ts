import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PlatformService } from './platform.service';

describe('PlatformService organization detail', () => {
  const organizationId = 'c2d02a42-e03a-4f78-99e9-78186c2a7851';
  const organization = {
    id: organizationId,
    name: 'Clínica Central',
    slug: 'clinica-central',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-02-01T10:00:00.000Z'),
    timezone: 'America/Bogota',
    locale: 'es-CO',
    currencyCode: 'COP',
    _count: { memberships: 3, clinicLocations: 1 },
    clinicLocations: [
      {
        id: '6a58a437-91ee-4f66-94e9-3e6853b086c2',
        name: 'Sede principal',
        status: 'ACTIVE',
        city: 'Bogotá',
      },
    ],
  };
  const findUnique = jest.fn<(args: unknown) => Promise<typeof organization | null>>();
  const groupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const findMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const prisma = {
    organization: { findUnique },
    membership: { groupBy },
    platformAuditEvent: { findMany },
  } as unknown as PrismaService;
  const service = new PlatformService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(organization);
    groupBy.mockResolvedValue([
      { status: 'ACTIVE', role: 'OWNER', _count: { _all: 1 } },
      { status: 'ACTIVE', role: 'VETERINARIAN', _count: { _all: 1 } },
      { status: 'INVITED', role: 'RECEPTION', _count: { _all: 1 } },
    ]);
    findMany.mockResolvedValue([
      {
        id: 'bd9de4ad-f702-4643-993b-a0c0e319e500',
        metadata: { from: 'ACTIVE', to: 'SUSPENDED', reason: 'Validación administrativa' },
        createdAt: new Date('2026-02-01T11:00:00.000Z'),
        actor: { email: 'admin@easyvet.co' },
      },
    ]);
  });

  it('returns only aggregated membership data and scoped administrative activity', async () => {
    await expect(service.organizationDetail(organizationId)).resolves.toMatchObject({
      id: organizationId,
      memberships: {
        total: 3,
        active: 2,
        invited: 1,
        suspended: 0,
        byRole: [
          { role: 'OWNER', count: 1 },
          { role: 'RECEPTION', count: 1 },
          { role: 'VETERINARIAN', count: 1 },
        ],
      },
      locations: { total: 1, data: [{ name: 'Sede principal', city: 'Bogotá' }] },
      recentAdministrativeActivity: [
        {
          actorEmail: 'admin@easyvet.co',
          from: 'ACTIVE',
          to: 'SUSPENDED',
          reason: 'Validación administrativa',
        },
      ],
    });

    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId } }));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId }, take: 10 }),
    );
  });

  it('returns not found without querying related records for an unknown clinic', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.organizationDetail(organizationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(groupBy).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
