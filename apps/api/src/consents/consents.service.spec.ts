import { describe, expect, it, jest } from '@jest/globals';
import { ConsentStatus, ClinicalEncounterStatus } from '@prisma/client';
import type { TenantContext } from '../authorization/authorization.types';
import { ConsentListQueryDto } from '../documents/documents.dto';
import { ConsentsService } from './consents.service';

const organizationId = '00000000-0000-4000-8000-000000000501';
const patientId = '00000000-0000-4000-8000-000000000502';
const encounterId = '00000000-0000-4000-8000-000000000503';

describe('ConsentsService pagination', () => {
  it('applies the tenant, encounter, page and page-size boundaries in the database query', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const row = {
      id: '00000000-0000-4000-8000-000000000504',
      organizationId,
      patientId,
      clinicalEncounterId: encounterId,
      clinicalProcedureId: null,
      status: ConsentStatus.DRAFT,
      version: 1,
      title: 'Autorización',
      purposeText: null,
      risksText: null,
      benefitsText: null,
      alternativesText: null,
      estimatedCostText: null,
      declarationText: null,
      responsiblePractitionerMembershipId: null,
      patientNameSnapshot: null,
      ownerDisplayNameSnapshot: null,
      ownerDocumentTypeSnapshot: null,
      ownerDocumentNumberSnapshot: null,
      professionalDisplayNameSnapshot: null,
      professionalLicenseSnapshot: null,
      contentSha256: null,
      issuedAt: null,
      signedAt: null,
      voidedAt: null,
      voidReason: null,
      createdAt,
      updatedAt: createdAt,
      patient: { status: 'ACTIVE' },
      clinicalEncounter: { status: ClinicalEncounterStatus.DRAFT },
      clinicalProcedure: null,
      signatureRequests: [],
    };
    const count = jest.fn<(input: unknown) => Promise<number>>().mockResolvedValue(11);
    const findMany = jest
      .fn<(input: unknown) => Promise<(typeof row)[]>>()
      .mockResolvedValue([row]);
    const prisma = {
      patient: {
        findFirst: jest
          .fn<(input: unknown) => Promise<{ id: string }>>()
          .mockResolvedValue({ id: patientId }),
      },
      consent: { count, findMany },
      clinicalDocument: {
        findFirst: jest.fn<(input: unknown) => Promise<null>>().mockResolvedValue(null),
      },
      $transaction: jest.fn((operations: readonly Promise<unknown>[]) => Promise.all(operations)),
    };
    const service = new ConsentsService(prisma as never, {} as never, {} as never);
    const query = Object.assign(new ConsentListQueryDto(), {
      page: 2,
      pageSize: 5,
      clinicalEncounterId: encounterId,
    });
    const tenant: TenantContext = {
      organizationId,
      membershipId: '00000000-0000-4000-8000-000000000505',
      role: 'OWNER',
      clinicalRole: 'PRACTITIONER',
      userId: '00000000-0000-4000-8000-000000000506',
    };

    const result = await service.listByPatient(tenant, patientId, query);

    expect(count).toHaveBeenCalledWith({
      where: { organizationId, patientId, clinicalEncounterId: encounterId },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, patientId, clinicalEncounterId: encounterId },
        skip: 5,
        take: 5,
      }),
    );
    expect(result.pagination).toEqual({ page: 2, pageSize: 5, total: 11 });
    expect(result.data).toHaveLength(1);
  });
});
