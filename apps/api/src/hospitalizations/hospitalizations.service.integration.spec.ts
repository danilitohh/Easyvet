import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { HospitalizationsService } from './hospitalizations.service';
import type { TenantContext } from '../authorization/authorization.types';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

// Real PostgreSQL integration coverage exercises lifecycle, tenant predicates, CAS and append-only Kardex rules.
describeDatabase('hospitalizations service', () => {
  let prisma: PrismaClient;
  let service: HospitalizationsService;
  let organizationId: string;
  let foreignOrganizationId: string;
  let practitioner: TenantContext;
  let assistant: TenantContext;
  let ownerId: string;
  let patientId: string;
  let encounterId: string;
  let foreignHospitalizationId: string;
  const ids: {
    organizations: string[];
    users: string[];
    memberships: string[];
    locations: string[];
    owners: string[];
    patients: string[];
    records: string[];
    encounters: string[];
  } = {
    organizations: [],
    users: [],
    memberships: [],
    locations: [],
    owners: [],
    patients: [],
    records: [],
    encounters: [],
  };
  const suffix = Date.now().toString(36);

  async function makeEncounter(
    targetOrganizationId: string,
    targetPatientId: string,
    creatorMembershipId: string,
  ) {
    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: targetPatientId },
      select: { ownerId: true },
    });
    const location = await prisma.clinicLocation.create({
      data: { organizationId: targetOrganizationId, name: 'QA Hospital' },
    });
    ids.locations.push(location.id);
    const record = await prisma.clinicalRecord.upsert({
      where: {
        patientId_organizationId: {
          patientId: targetPatientId,
          organizationId: targetOrganizationId,
        },
      },
      update: {},
      create: { organizationId: targetOrganizationId, patientId: targetPatientId },
    });
    ids.records.push(record.id);
    const encounter = await prisma.clinicalEncounter.create({
      data: {
        organizationId: targetOrganizationId,
        clinicalRecordId: record.id,
        patientId: targetPatientId,
        ownerIdAtTime: patient.ownerId,
        clinicLocationId: location.id,
        reason: 'Hospitalization integration QA',
        occurredAt: new Date('2035-01-08T10:00:00.000Z'),
        createdByMembershipId: creatorMembershipId,
      },
    });
    ids.encounters.push(encounter.id);
    return encounter.id;
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL_TEST;
    if (!url) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    service = new HospitalizationsService(prisma as never);
    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: {
          name: 'Hospital QA Norte ' + suffix,
          slug: 'hospital-qa-norte-' + suffix,
          timezone: 'America/Bogota',
        },
      }),
      prisma.organization.create({
        data: { name: 'Hospital QA Sur ' + suffix, slug: 'hospital-qa-sur-' + suffix },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    ids.organizations.push(organizationId, foreignOrganizationId);
    const userData = ['practitioner', 'assistant', 'manager', 'foreign'].map((role) => ({
      email: 'hospital-' + role + '-' + suffix + '@example.local',
      passwordHash: 'integration-only',
    }));
    const users = await Promise.all(userData.map((data) => prisma.user.create({ data })));
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
          organizationId,
          role: 'ASSISTANT',
          clinicalRole: 'CLINICAL_ASSISTANT',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: { userId: users[2]!.id, organizationId, role: 'ADMIN', status: 'ACTIVE' },
      }),
      prisma.membership.create({
        data: {
          userId: users[3]!.id,
          organizationId: foreignOrganizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
    ]);
    ids.memberships.push(...memberships.map((membership) => membership.id));
    await prisma.membershipProfessionalProfile.create({
      data: {
        organizationId,
        membershipId: memberships[0]!.id,
        displayName: 'Dra. Hospital QA',
        licenseNumber: 'HOSP-QA-1',
      },
    });
    const owner = await prisma.owner.create({
      data: { organizationId, firstName: 'Camila', lastName: 'Hospital QA' },
    });
    const foreignOwner = await prisma.owner.create({
      data: { organizationId: foreignOrganizationId, firstName: 'Sur', lastName: 'Hospital QA' },
    });
    ownerId = owner.id;
    ids.owners.push(owner.id, foreignOwner.id);
    const patient = await prisma.patient.create({
      data: {
        organizationId,
        ownerId,
        name: 'Luna Hospital QA',
        nameNormalized: 'luna hospital qa',
        species: 'DOG',
      },
    });
    const foreignPatient = await prisma.patient.create({
      data: {
        organizationId: foreignOrganizationId,
        ownerId: foreignOwner.id,
        name: 'Sur Hospital QA',
        nameNormalized: 'sur hospital qa',
        species: 'CAT',
      },
    });
    patientId = patient.id;
    ids.patients.push(patient.id, foreignPatient.id);
    practitioner = {
      organizationId,
      membershipId: memberships[0]!.id,
      role: 'VETERINARIAN',
      clinicalRole: 'PRACTITIONER',
      userId: users[0]!.id,
    };
    assistant = {
      organizationId,
      membershipId: memberships[1]!.id,
      role: 'ASSISTANT',
      clinicalRole: 'CLINICAL_ASSISTANT',
      userId: users[1]!.id,
    };
    encounterId = await makeEncounter(organizationId, patientId, practitioner.membershipId);
    foreignHospitalizationId = await service
      .create(
        {
          organizationId: foreignOrganizationId,
          membershipId: memberships[3]!.id,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          userId: users[3]!.id,
        },
        await makeEncounter(foreignOrganizationId, foreignPatient.id, memberships[3]!.id),
        {},
      )
      .then((row) => row.id);
  }, 30_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.hospitalizationEntry.deleteMany({
      where: { organizationId: { in: ids.organizations } },
    });
    await prisma.clinicalAuditEvent.deleteMany({
      where: { organizationId: { in: ids.organizations } },
    });
    await prisma.hospitalization.deleteMany({
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
  }, 30_000);

  it('covers draft, active, append-only entries, discharge, void, CAS and tenant isolation', async () => {
    const draft = await service.create(assistant, encounterId, {
      admittedAt: '2035-01-08T15:00:00.000Z',
      admissionReason: 'QA',
    });
    expect(draft.status).toBe('DRAFT');
    await expect(service.create(assistant, encounterId, {})).rejects.toMatchObject({
      response: { code: 'HOSPITALIZATION_EXISTS_FOR_ENCOUNTER' },
    });
    await expect(
      service.findOne({ ...practitioner, organizationId: foreignOrganizationId }, draft.id),
    ).rejects.toMatchObject({ response: { code: 'HOSPITALIZATION_NOT_FOUND' } });
    await expect(service.activate(assistant, draft.id, draft.version)).rejects.toMatchObject({
      response: { code: 'RESPONSIBLE_PRACTITIONER_REQUIRED' },
    });
    const assigned = await service.updateDraft(assistant, draft.id, {
      expectedVersion: draft.version,
      responsiblePractitionerMembershipId: practitioner.membershipId,
    });
    const active = await service.activate(practitioner, draft.id, assigned.version);
    expect(active.status).toBe('ACTIVE');
    expect(active.patientNameSnapshot).toBe('Luna Hospital QA');
    const entry = await service.createEntry(assistant, draft.id, {
      expectedVersion: active.version,
      entryType: 'MONITORING',
      recordedAt: '2035-01-08T16:00:00.000Z',
      heartRateBpm: 0,
      respiratoryRatePerMinute: 0,
    });
    expect(entry.heartRateBpm).toBe(0);
    await expect(
      service.createEntry(assistant, draft.id, {
        expectedVersion: active.version,
        entryType: 'OTHER',
        recordedAt: '2035-01-08T16:00:00.000Z',
        content: 'stale',
      }),
    ).rejects.toMatchObject({ response: { code: 'HOSPITALIZATION_STALE' } });
    const updated = await service.updateDraft(assistant, draft.id, {
      expectedVersion: active.version + 1,
      treatmentPlan: 'Plan QA',
    });
    expect(updated.treatmentPlan).toBe('Plan QA');
    const discharged = await service.discharge(practitioner, draft.id, {
      expectedVersion: updated.version,
      dischargedAt: '2035-01-08T17:00:00.000Z',
      dischargeSummary: 'Alta QA',
    });
    expect(discharged.status).toBe('DISCHARGED');
    await expect(
      service.updateDraft(assistant, draft.id, {
        expectedVersion: discharged.version,
        notes: 'no',
      }),
    ).rejects.toMatchObject({ response: { code: 'HOSPITALIZATION_IMMUTABLE' } });
    const voided = await service.void(practitioner, draft.id, {
      expectedVersion: discharged.version,
      reason: 'Corrección QA',
    });
    expect(voided.status).toBe('VOIDED');
    await expect(
      service.void(practitioner, draft.id, { expectedVersion: voided.version, reason: 'again' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_HOSPITALIZATION_STATE' } });
    await expect(service.findOne(practitioner, foreignHospitalizationId)).rejects.toMatchObject({
      response: { code: 'HOSPITALIZATION_NOT_FOUND' },
    });
  });

  it('rejects empty and invalid Kardex measurements and preserves patient weight', async () => {
    const encounter = await makeEncounter(organizationId, patientId, practitioner.membershipId);
    const draft = await service.create(practitioner, encounter, {
      admittedAt: '2035-01-09T15:00:00.000Z',
      responsiblePractitionerMembershipId: practitioner.membershipId,
    });
    const active = await service.activate(practitioner, draft.id, draft.version);
    const before = await prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: { currentWeightKg: true },
    });
    await expect(
      service.createEntry(assistant, active.id, {
        expectedVersion: active.version,
        entryType: 'OTHER',
        recordedAt: '2035-01-09T16:00:00.000Z',
      }),
    ).rejects.toMatchObject({ response: { code: 'HOSPITALIZATION_ENTRY_EMPTY' } });
    await expect(
      service.createEntry(assistant, active.id, {
        expectedVersion: active.version,
        entryType: 'OTHER',
        recordedAt: '2035-01-09T16:00:00.000Z',
        weightKg: 0,
      }),
    ).rejects.toThrow();
    await service.createEntry(assistant, active.id, {
      expectedVersion: active.version,
      entryType: 'MONITORING',
      recordedAt: '2035-01-09T16:00:00.000Z',
      weightKg: 4.2,
    });
    const after = await prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: { currentWeightKg: true },
    });
    expect(after.currentWeightKg?.toString() ?? null).toBe(
      before.currentWeightKg?.toString() ?? null,
    );
  });

  it('serializes concurrent CAS updates and Kardex versus discharge', async () => {
    const encounter = await makeEncounter(organizationId, patientId, practitioner.membershipId);
    const draft = await service.create(practitioner, encounter, {
      admittedAt: '2035-01-10T15:00:00.000Z',
      responsiblePractitionerMembershipId: practitioner.membershipId,
    });
    const active = await service.activate(practitioner, draft.id, draft.version);

    const updates = await Promise.allSettled([
      service.updateDraft(assistant, active.id, {
        expectedVersion: active.version,
        treatmentPlan: 'Concurrent A',
      }),
      service.updateDraft(assistant, active.id, {
        expectedVersion: active.version,
        treatmentPlan: 'Concurrent B',
      }),
    ]);
    expect(updates.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(updates.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const current = await service.findOne(practitioner, active.id);
    const terminalRace = await Promise.allSettled([
      service.createEntry(assistant, active.id, {
        expectedVersion: current.version,
        entryType: 'MONITORING',
        recordedAt: '2035-01-10T16:00:00.000Z',
        content: 'Concurrent Kardex',
      }),
      service.discharge(practitioner, active.id, {
        expectedVersion: current.version,
        dischargedAt: '2035-01-10T17:00:00.000Z',
        dischargeSummary: 'Concurrent discharge',
      }),
    ]);
    expect(terminalRace.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(terminalRace.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const final = await service.findOne(practitioner, active.id);
    expect(['ACTIVE', 'DISCHARGED']).toContain(final.status);
  });
});
