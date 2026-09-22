import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { Environment } from '../config/env';
import type { TenantContext } from '../authorization/authorization.types';
import { ClinicalService } from '../clinical/clinical.service';
import { PatientsService } from '../patients/patients.service';
import { LocalStorageAdapter } from '../storage/local-storage.adapter';
import { DocumentsService } from '../documents/documents.service';
import { ConsentsService } from './consents.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const testConsentText = {
  title: 'Consentimiento de QA',
  declarationText: 'Acepto el procedimiento ficticio descrito.',
  purposeText: 'Verificación funcional local.',
};
const requestContext = {
  ip: '127.0.0.1',
  get: (name: string) =>
    name.toLowerCase() === 'user-agent' ? 'Easyvet integration test' : undefined,
} as unknown as Request;

// PostgreSQL integration covers one-time signing, immutable evidence, lifecycle races, and the private file store.
describeDatabase('consent lifecycle PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let consents: ConsentsService;
  let documents: DocumentsService;
  let clinical: ClinicalService;
  let patients: PatientsService;
  let tenant: TenantContext;
  let organizationId: string;
  let foreignOrganizationId: string;
  let patientId: string;
  let encounterId: string;
  let storageRoot: string;
  const suffix = Date.now().toString(36);
  const ids = {
    organizations: [] as string[],
    users: [] as string[],
    memberships: [] as string[],
    owners: [] as string[],
    patients: [] as string[],
    locations: [] as string[],
    records: [] as string[],
    encounters: [] as string[],
  };

  function localTestDatabaseUrl(): string {
    const url = process.env.DATABASE_URL_TEST;
    if (!url) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    const parsed = new URL(url);
    if (
      !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
      parsed.pathname !== '/easyvet_test'
    ) {
      throw new Error('Database integration tests are restricted to local easyvet_test');
    }
    return url;
  }

  async function createConsent(title = testConsentText.title) {
    return consents.createDraft(tenant, patientId, encounterId, {
      title,
      declarationText: testConsentText.declarationText,
      purposeText: testConsentText.purposeText,
      responsiblePractitionerMembershipId: tenant.membershipId,
    });
  }

  async function issueConsent() {
    const draft = await createConsent();
    return { draft, issued: await consents.issue(tenant, draft.id, draft.version) };
  }

  async function sign(token: string, code: string) {
    return consents.signPublic(
      token,
      {
        verificationCode: code,
        signerName: 'Camila Rojas QA',
        signatureMethod: 'TYPED',
        accepted: 'true',
      },
      undefined,
      requestContext,
    );
  }

  beforeAll(async () => {
    const databaseUrl = localTestDatabaseUrl();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    storageRoot = await mkdtemp(join(tmpdir(), 'easyvet-consent-test-'));
    const storage = new LocalStorageAdapter(storageRoot);
    const config = new ConfigService({
      SIGNATURE_REQUEST_TTL_HOURS: 72,
      SIGNATURE_REQUEST_MAX_ATTEMPTS: 5,
    }) as unknown as ConfigService<Environment, true>;
    consents = new ConsentsService(prisma as never, storage, config);
    documents = new DocumentsService(prisma as never, storage);
    clinical = new ClinicalService(prisma as never);
    patients = new PatientsService(prisma as never);

    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: {
          name: `Document QA Norte ${suffix}`,
          slug: `document-qa-norte-${suffix}`,
          timezone: 'America/Bogota',
        },
      }),
      prisma.organization.create({
        data: { name: `Document QA Sur ${suffix}`, slug: `document-qa-sur-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    ids.organizations.push(organizationId, foreignOrganizationId);

    const users = await Promise.all(
      ['practitioner', 'foreign'].map((role) =>
        prisma.user.create({
          data: {
            email: `document-${role}-${suffix}@example.local`,
            passwordHash: 'integration-only',
          },
        }),
      ),
    );
    ids.users.push(...users.map((user) => user.id));
    const memberships = await Promise.all([
      prisma.membership.create({
        data: {
          userId: users[0]!.id,
          organizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: users[1]!.id,
          organizationId: foreignOrganizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
    ]);
    ids.memberships.push(...memberships.map((membership) => membership.id));
    tenant = {
      organizationId,
      membershipId: memberships[0]!.id,
      role: 'VETERINARIAN',
      clinicalRole: 'PRACTITIONER',
      userId: users[0]!.id,
    };
    await prisma.membershipProfessionalProfile.create({
      data: {
        organizationId,
        membershipId: tenant.membershipId,
        displayName: 'Dra. Documentos QA',
        licenseNumber: 'DOC-QA-1',
      },
    });

    const [owner, foreignOwner] = await Promise.all([
      prisma.owner.create({ data: { organizationId, firstName: 'Camila', lastName: 'Rojas QA' } }),
      prisma.owner.create({
        data: { organizationId: foreignOrganizationId, firstName: 'Sur', lastName: 'QA' },
      }),
    ]);
    ids.owners.push(owner.id, foreignOwner.id);
    const [patient, foreignPatient] = await Promise.all([
      prisma.patient.create({
        data: {
          organizationId,
          ownerId: owner.id,
          name: 'Luna Consent QA',
          nameNormalized: 'luna consent qa',
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwner.id,
          name: 'Sur Consent QA',
          nameNormalized: 'sur consent qa',
          species: 'CAT',
        },
      }),
    ]);
    patientId = patient.id;
    ids.patients.push(patient.id, foreignPatient.id);
    const [location, record] = await Promise.all([
      prisma.clinicLocation.create({ data: { organizationId, name: 'QA Norte' } }),
      prisma.clinicalRecord.create({ data: { organizationId, patientId } }),
    ]);
    ids.locations.push(location.id);
    ids.records.push(record.id);
    const encounter = await prisma.clinicalEncounter.create({
      data: {
        organizationId,
        clinicalRecordId: record.id,
        patientId,
        ownerIdAtTime: owner.id,
        clinicLocationId: location.id,
        responsibleMembershipId: tenant.membershipId,
        reason: 'Consent QA',
        occurredAt: new Date('2035-01-08T15:00:00.000Z'),
        createdByMembershipId: tenant.membershipId,
      },
    });
    encounterId = encounter.id;
    ids.encounters.push(encounterId);
    await clinical.finalizeEncounter(tenant, encounterId, { expectedVersion: encounter.version });
  }, 30_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.clinicalDocument.deleteMany({
      where: { organizationId: { in: ids.organizations } },
    });
    await prisma.consentSignatureRequest.deleteMany({
      where: { organizationId: { in: ids.organizations } },
    });
    await prisma.consent.deleteMany({ where: { organizationId: { in: ids.organizations } } });
    await prisma.clinicalAuditEvent.deleteMany({
      where: { organizationId: { in: ids.organizations } },
    });
    await prisma.clinicalEncounter.deleteMany({ where: { id: { in: ids.encounters } } });
    await prisma.clinicalRecord.deleteMany({ where: { id: { in: ids.records } } });
    await prisma.patient.deleteMany({ where: { id: { in: ids.patients } } });
    await prisma.owner.deleteMany({ where: { id: { in: ids.owners } } });
    await prisma.clinicLocation.deleteMany({ where: { id: { in: ids.locations } } });
    await prisma.membershipProfessionalProfile.deleteMany({
      where: { membershipId: { in: ids.memberships } },
    });
    await prisma.membership.deleteMany({ where: { id: { in: ids.memberships } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids.organizations } } });
    await prisma.$disconnect();
    if (storageRoot) await rm(storageRoot, { recursive: true, force: true });
  }, 30_000);

  it('stores a private upload, verifies its hash, hides storage keys, and preserves a voided artifact', async () => {
    const bytes = Buffer.from('%PDF-1.7 local fictitious document');
    const uploaded = await documents.upload(
      tenant,
      patientId,
      { title: 'Resultado ficticio', clinicalEncounterId: encounterId },
      {
        buffer: bytes,
        size: bytes.byteLength,
        mimetype: 'application/pdf',
        originalname: '..\\result.pdf',
      } as never,
    );
    expect(uploaded.originalFileName).toBe('result.pdf');
    expect(uploaded).not.toHaveProperty('storageKey');
    const foreignTenant = { ...tenant, organizationId: foreignOrganizationId };
    await expect(documents.download(foreignTenant, uploaded.id)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_NOT_FOUND' },
    });
    const downloaded = await documents.download(tenant, uploaded.id);
    expect(downloaded.bytes).toEqual(bytes);
    expect(downloaded.metadata.sha256).toBe(uploaded.sha256);
    const voided = await documents.void(tenant, uploaded.id, 'Archivo duplicado de QA');
    expect(voided.status).toBe('VOIDED');
    expect((await documents.download(tenant, uploaded.id)).bytes).toEqual(bytes);
  });

  it('issues, reissues, signs, snapshots identity, creates a hashed PDF, and voids without deleting evidence', async () => {
    const draft = await createConsent();
    const first = await consents.issue(tenant, draft.id, draft.version);
    expect(first.verificationCode).toMatch(/^\d{6}$/);
    expect(first.consent.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.consent.patientNameSnapshot).toBe('Luna Consent QA');
    expect(first.consent.ownerDisplayNameSnapshot).toBe('Camila Rojas QA');
    expect(first.consent.professionalDisplayNameSnapshot).toBe('Dra. Documentos QA');
    const request = await prisma.consentSignatureRequest.findFirstOrThrow({
      where: { consentId: draft.id },
    });
    expect(request.tokenHash).not.toBe(first.signingPath.split('/').at(-1));
    expect(request.otpHash).not.toBe(first.verificationCode);
    await expect(
      consents.getPublicConsent(first.signingPath.split('/').at(-1)!),
    ).resolves.toMatchObject({ ownerDocumentMasked: null, patientName: 'Luna Consent QA' });

    const reissued = await consents.reissue(tenant, draft.id, first.consent.version);
    expect(
      await prisma.consentSignatureRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ).toMatchObject({ status: 'REVOKED' });
    await expect(
      consents.getPublicConsent(first.signingPath.split('/').at(-1)!),
    ).rejects.toMatchObject({ response: { code: 'SIGNATURE_UNAVAILABLE' } });

    const newToken = reissued.signingPath.split('/').at(-1)!;
    await expect(sign(newToken, '999999')).rejects.toMatchObject({
      response: { code: 'SIGNATURE_UNAVAILABLE' },
    });
    const currentRequest = await prisma.consentSignatureRequest.findFirstOrThrow({
      where: { consentId: draft.id, status: 'PENDING' },
    });
    expect(currentRequest.failedAttempts).toBe(1);
    const signed = await sign(newToken, reissued.verificationCode);
    expect(signed.signatureMethod).toBe('TYPED');
    const detail = await consents.findOne(tenant, draft.id);
    expect(detail.status).toBe('SIGNED');
    expect(detail.signedDocumentId).toBeTruthy();
    const pdf = await documents.download(tenant, detail.signedDocumentId!);
    expect(pdf.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.metadata.sha256).toBe(
      (await prisma.clinicalDocument.findUniqueOrThrow({ where: { id: detail.signedDocumentId! } }))
        .sha256,
    );
    expect(await prisma.clinicalDocument.count({ where: { sourceId: draft.id } })).toBe(1);

    const voided = await consents.void(tenant, draft.id, detail.version, 'Retiro de QA');
    expect(voided.status).toBe('VOIDED');
    expect((await documents.download(tenant, detail.signedDocumentId!)).bytes).toEqual(pdf.bytes);
    const signatureAudit = await prisma.clinicalAuditEvent.findFirstOrThrow({
      where: { organizationId, entityId: draft.id, action: 'CONSENT_SIGNED' },
    });
    expect(JSON.stringify(signatureAudit.metadata)).not.toContain('Camila Rojas');
    expect(JSON.stringify(signatureAudit.metadata)).not.toContain('Retiro de QA');
  }, 30_000);

  it('serializes valid signing, reissue-versus-sign, and void-versus-sign races', async () => {
    const simultaneous = await issueConsent();
    const token = simultaneous.issued.signingPath.split('/').at(-1)!;
    const attempts = await Promise.allSettled([
      sign(token, simultaneous.issued.verificationCode),
      sign(token, simultaneous.issued.verificationCode),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.clinicalDocument.count({ where: { sourceId: simultaneous.draft.id } }),
    ).toBe(1);
    expect(
      await prisma.clinicalAuditEvent.count({
        where: {
          organizationId,
          entityId: simultaneous.draft.id,
          action: 'CONSENT_SIGNED',
        },
      }),
    ).toBe(1);

    const reissueRace = await issueConsent();
    const oldToken = reissueRace.issued.signingPath.split('/').at(-1)!;
    const reissueOutcomes = await Promise.allSettled([
      consents.reissue(tenant, reissueRace.draft.id, reissueRace.issued.consent.version),
      sign(oldToken, reissueRace.issued.verificationCode),
    ]);
    expect(reissueOutcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const reissueState = await prisma.consent.findUniqueOrThrow({
      where: { id: reissueRace.draft.id },
      include: { signatureRequests: true },
    });
    if (reissueState.status === 'SIGNED') {
      expect(
        reissueState.signatureRequests.filter((request) => request.status === 'SIGNED'),
      ).toHaveLength(1);
    } else {
      expect(reissueState.status).toBe('ISSUED');
      expect(
        reissueState.signatureRequests.filter((request) => request.status === 'REVOKED'),
      ).toHaveLength(1);
      await expect(consents.getPublicConsent(oldToken)).rejects.toMatchObject({
        response: { code: 'SIGNATURE_UNAVAILABLE' },
      });
    }

    const voidRace = await issueConsent();
    const voidToken = voidRace.issued.signingPath.split('/').at(-1)!;
    const voidOutcomes = await Promise.allSettled([
      sign(voidToken, voidRace.issued.verificationCode),
      consents.void(tenant, voidRace.draft.id, voidRace.issued.consent.version, 'Void race QA'),
    ]);
    expect(voidOutcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const voidState = await prisma.consent.findUniqueOrThrow({ where: { id: voidRace.draft.id } });
    expect(['SIGNED', 'VOIDED']).toContain(voidState.status);
    if (voidState.status === 'VOIDED') {
      await expect(consents.getPublicConsent(voidToken)).rejects.toMatchObject({
        response: { code: 'SIGNATURE_UNAVAILABLE' },
      });
    }
  }, 60_000);

  it('enforces attempt limits, expiry, archived-patient and voided-parent restrictions', async () => {
    const lockout = await issueConsent();
    const lockoutToken = lockout.issued.signingPath.split('/').at(-1)!;
    const wrongAttempts = await Promise.allSettled(
      Array.from({ length: 6 }, () => sign(lockoutToken, '111111')),
    );
    expect(wrongAttempts.every((result) => result.status === 'rejected')).toBe(true);
    expect(
      await prisma.consentSignatureRequest.findFirstOrThrow({
        where: { consentId: lockout.draft.id },
      }),
    ).toMatchObject({ failedAttempts: 5, maxAttempts: 5 });
    await expect(consents.getPublicConsent(lockoutToken)).rejects.toMatchObject({
      response: { code: 'SIGNATURE_UNAVAILABLE' },
    });

    const expiring = await issueConsent();
    const expiredToken = expiring.issued.signingPath.split('/').at(-1)!;
    const pastCreatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expiredAt = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.consentSignatureRequest.updateMany({
      where: { consentId: expiring.draft.id },
      data: { createdAt: pastCreatedAt, expiresAt: expiredAt },
    });
    await expect(consents.getPublicConsent(expiredToken)).rejects.toMatchObject({
      response: { code: 'SIGNATURE_UNAVAILABLE' },
    });

    const archive = await createConsent();
    await patients.archiveForOrganization(organizationId, patientId);
    await expect(consents.issue(tenant, archive.id, archive.version)).rejects.toMatchObject({
      response: { code: 'PATIENT_ARCHIVED' },
    });
    await prisma.patient.update({
      where: { id: patientId },
      data: { status: 'ACTIVE', archivedAt: null },
    });

    const parentConsent = await createConsent();
    const parentIssue = await consents.issue(tenant, parentConsent.id, parentConsent.version);
    await clinical.voidEncounter(tenant, encounterId, {
      expectedVersion: 2,
      reason: 'Cierre de Encounter QA',
    });
    await expect(
      consents.signPublic(
        parentIssue.signingPath.split('/').at(-1)!,
        {
          verificationCode: parentIssue.verificationCode,
          signerName: 'Camila Rojas QA',
          signatureMethod: 'TYPED',
          accepted: 'true',
        },
        undefined,
        requestContext,
      ),
    ).rejects.toMatchObject({ response: { code: 'SIGNATURE_UNAVAILABLE' } });
  }, 60_000);
});
