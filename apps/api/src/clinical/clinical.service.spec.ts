import { describe, expect, it, jest } from '@jest/globals';
import { ClinicalMembershipListQueryDto, ClinicalVitalQueryDto } from './clinical.dto';
import { ClinicalService } from './clinical.service';

const organizationId = '00000000-0000-4000-8000-000000000801';
const encounterId = '00000000-0000-4000-8000-000000000802';

describe('ClinicalService vital history pagination', () => {
  it('keeps vital history tenant-scoped and bounded', async () => {
    const findMany = jest.fn<(input: unknown) => Promise<unknown[]>>().mockResolvedValue([]);
    const count = jest.fn<(input: unknown) => Promise<number>>().mockResolvedValue(205);
    const prisma = {
      clinicalEncounter: {
        findFirst: jest
          .fn<(input: unknown) => Promise<{ id: string }>>()
          .mockResolvedValue({ id: encounterId }),
      },
      vitalMeasurement: { findMany, count },
    };
    const service = new ClinicalService(prisma as never);
    const query = Object.assign(new ClinicalVitalQueryDto(), { page: 3, pageSize: 50 });

    const result = await service.listVitals(
      {
        organizationId,
        membershipId: '00000000-0000-4000-8000-000000000803',
        role: 'OWNER',
        clinicalRole: 'PRACTITIONER',
        userId: '00000000-0000-4000-8000-000000000804',
      },
      encounterId,
      query,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, clinicalEncounterId: encounterId },
        skip: 100,
        take: 50,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: { organizationId, clinicalEncounterId: encounterId },
    });
    expect(result.pagination).toEqual({ page: 3, pageSize: 50, total: 205, totalPages: 5 });
  });
});

describe('ClinicalService membership selector pagination', () => {
  it('keeps clinical member lookups tenant-scoped and bounded', async () => {
    const findMany = jest.fn<(input: unknown) => Promise<unknown[]>>().mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000805',
        clinicalRole: 'CLINICAL_ASSISTANT',
        professionalProfile: { displayName: 'Asistente de prueba' },
      },
    ]);
    const count = jest.fn<(input: unknown) => Promise<number>>().mockResolvedValue(125);
    const prisma = {
      membership: { findMany, count },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const service = new ClinicalService(prisma as never);
    const query = Object.assign(new ClinicalMembershipListQueryDto(), { page: 2, pageSize: 50 });

    const result = await service.listClinicalMembers(
      {
        organizationId,
        membershipId: '00000000-0000-4000-8000-000000000803',
        role: 'OWNER',
        clinicalRole: 'PRACTITIONER',
        userId: '00000000-0000-4000-8000-000000000804',
      },
      query,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId }),
    });
    expect(result.pagination).toEqual({ page: 2, pageSize: 50, total: 125, totalPages: 3 });
  });
});
