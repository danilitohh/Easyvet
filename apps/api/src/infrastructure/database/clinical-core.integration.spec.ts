import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

type Fixture = {
  organization: { id: string };
  location: { id: string };
  user: { id: string };
  membership: { id: string };
  owner: { id: string };
  patient: { id: string };
  record: { id: string };
};

describeDatabase('clinical core foundation database invariants', () => {
  let prisma: PrismaClient;
  const suffix = Date.now().toString();
  const organizationIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.clinicalAuditEvent.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.vitalMeasurement.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.clinicalEvolution.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.clinicalEncounter.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.membershipProfessionalProfile.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.clinicalRecord.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.owner.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.clinicLocation.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.membership.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function fixture(
    clinicalRole: 'PRACTITIONER' | 'CLINICAL_ASSISTANT' | null = 'PRACTITIONER',
  ) {
    const key = `${suffix}-${organizationIds.length}`;
    const organization = await prisma.organization.create({
      data: { name: `Clinical ${key}`, slug: `clinical-${key}` },
    });
    organizationIds.push(organization.id);
    const location = await prisma.clinicLocation.create({
      data: { organizationId: organization.id, name: 'Clinical Location' },
    });
    const user = await prisma.user.create({
      data: { email: `clinical-${key}@example.local`, passwordHash: 'hash' },
    });
    userIds.push(user.id);
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: 'OWNER',
        status: 'ACTIVE',
        clinicalRole,
      },
    });
    const owner = await prisma.owner.create({
      data: { organizationId: organization.id, firstName: 'Clinical', lastName: 'Owner' },
    });
    const patient = await prisma.patient.create({
      data: {
        organizationId: organization.id,
        ownerId: owner.id,
        name: 'Clinical Patient',
        nameNormalized: 'clinical patient',
        species: 'DOG',
      },
    });
    const record = await prisma.clinicalRecord.create({
      data: { organizationId: organization.id, patientId: patient.id },
    });
    return { organization, location, user, membership, owner, patient, record } satisfies Fixture;
  }

  async function encounterData(fixtureValue: Fixture, overrides: Record<string, unknown> = {}) {
    return {
      organizationId: fixtureValue.organization.id,
      clinicalRecordId: fixtureValue.record.id,
      patientId: fixtureValue.patient.id,
      ownerIdAtTime: fixtureValue.owner.id,
      clinicLocationId: fixtureValue.location.id,
      status: 'DRAFT' as const,
      version: 1,
      reason: 'Foundation test',
      occurredAt: new Date('2030-01-08T15:00:00.000Z'),
      createdByMembershipId: fixtureValue.membership.id,
      ...overrides,
    };
  }

  it('stores the two clinical roles as nullable membership metadata', async () => {
    const practitioner = await fixture('PRACTITIONER');
    const assistant = await fixture('CLINICAL_ASSISTANT');
    const noClinicalRole = await fixture(null);
    expect(
      (await prisma.membership.findUniqueOrThrow({ where: { id: practitioner.membership.id } }))
        .clinicalRole,
    ).toBe('PRACTITIONER');
    expect(
      (await prisma.membership.findUniqueOrThrow({ where: { id: assistant.membership.id } }))
        .clinicalRole,
    ).toBe('CLINICAL_ASSISTANT');
    expect(
      (await prisma.membership.findUniqueOrThrow({ where: { id: noClinicalRole.membership.id } }))
        .clinicalRole,
    ).toBeNull();
  });

  it('enforces one optional professional profile per membership', async () => {
    const f = await fixture();
    await prisma.membershipProfessionalProfile.create({
      data: {
        organizationId: f.organization.id,
        membershipId: f.membership.id,
        displayName: 'Dr. Profile',
      },
    });
    await expect(
      prisma.membershipProfessionalProfile.create({
        data: {
          organizationId: f.organization.id,
          membershipId: f.membership.id,
          displayName: 'Duplicate',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows a profile without a license number', async () => {
    const f = await fixture();
    const profile = await prisma.membershipProfessionalProfile.create({
      data: {
        organizationId: f.organization.id,
        membershipId: f.membership.id,
        displayName: 'No License',
      },
    });
    expect(profile.licenseNumber).toBeNull();
  });

  it('rejects a professional profile whose membership belongs to another tenant', async () => {
    const f = await fixture();
    const other = await fixture();
    await expect(
      prisma.membershipProfessionalProfile.create({
        data: {
          organizationId: f.organization.id,
          membershipId: other.membership.id,
          displayName: 'Cross tenant',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('enforces one clinical record per tenant patient', async () => {
    const f = await fixture();
    await expect(
      prisma.clinicalRecord.create({
        data: { organizationId: f.organization.id, patientId: f.patient.id },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a clinical record that crosses the patient tenant boundary', async () => {
    const f = await fixture();
    const other = await fixture();
    await expect(
      prisma.clinicalRecord.create({
        data: { organizationId: f.organization.id, patientId: other.patient.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('creates a draft encounter with optional responsible membership', async () => {
    const f = await fixture('CLINICAL_ASSISTANT');
    const encounter = await prisma.clinicalEncounter.create({ data: await encounterData(f) });
    expect(encounter.status).toBe('DRAFT');
    expect(encounter.responsibleMembershipId).toBeNull();
  });

  it('stores owner snapshots as historical foreign keys', async () => {
    const f = await fixture();
    const encounter = await prisma.clinicalEncounter.create({ data: await encounterData(f) });
    expect(encounter.ownerIdAtTime).toBe(f.owner.id);
    expect(encounter.patientId).toBe(f.patient.id);
  });

  it('requires finalization metadata for finalized encounters', async () => {
    const f = await fixture();
    const encounter = await prisma.clinicalEncounter.create({
      data: await encounterData(f, {
        status: 'FINALIZED',
        responsibleMembershipId: f.membership.id,
        professionalDisplayNameSnapshot: 'Dr. Final',
        finalizedAt: new Date('2030-01-08T16:00:00.000Z'),
        finalizedByMembershipId: f.membership.id,
      }),
    });
    expect(encounter.finalizedAt).not.toBeNull();
  });

  it('rejects draft encounters carrying finalization timestamps', async () => {
    const f = await fixture();
    await expect(
      prisma.clinicalEncounter.create({
        data: await encounterData(f, { finalizedAt: new Date() }),
      }),
    ).rejects.toThrow('violates check constraint');
  });

  it('rejects finalized encounters without finalizer metadata', async () => {
    const f = await fixture();
    await expect(
      prisma.clinicalEncounter.create({ data: await encounterData(f, { status: 'FINALIZED' }) }),
    ).rejects.toThrow('violates check constraint');
  });

  it('requires non-empty void reasons for voided encounters', async () => {
    const f = await fixture();
    await expect(
      prisma.clinicalEncounter.create({
        data: await encounterData(f, {
          status: 'VOIDED',
          finalizedAt: new Date(),
          finalizedByMembershipId: f.membership.id,
          voidedAt: new Date(),
          voidedByMembershipId: f.membership.id,
          voidReason: '   ',
        }),
      }),
    ).rejects.toThrow('violates check constraint');
  });

  it('keeps appointment linkage optional and one-to-one per tenant', async () => {
    const f = await fixture();
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: f.organization.id,
        clinicLocationId: f.location.id,
        patientId: f.patient.id,
        ownerId: f.owner.id,
        createdByMembershipId: f.membership.id,
        startsAt: new Date('2030-01-08T14:00:00.000Z'),
        endsAt: new Date('2030-01-08T14:30:00.000Z'),
        reason: 'Foundation appointment',
      },
    });
    await prisma.clinicalEncounter.create({
      data: await encounterData(f, { appointmentId: appointment.id }),
    });
    await expect(
      prisma.clinicalEncounter.create({
        data: await encounterData(f, { appointmentId: appointment.id }),
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces positive encounter versions', async () => {
    const f = await fixture();
    await expect(
      prisma.clinicalEncounter.create({ data: await encounterData(f, { version: 0 }) }),
    ).rejects.toThrow('violates check constraint');
  });

  it('requires tenant-safe owner and clinic location snapshots', async () => {
    const f = await fixture();
    await expect(
      prisma.clinicalEncounter.create({
        data: await encounterData(f, { ownerIdAtTime: '00000000-0000-4000-8000-ffffffffffff' }),
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      prisma.clinicalEncounter.create({
        data: await encounterData(f, { clinicLocationId: '00000000-0000-4000-8000-ffffffffffff' }),
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('stores append-only evolutions attached to a record and encounter', async () => {
    const f = await fixture();
    const encounter = await prisma.clinicalEncounter.create({ data: await encounterData(f) });
    const evolution = await prisma.clinicalEvolution.create({
      data: {
        organizationId: f.organization.id,
        clinicalRecordId: f.record.id,
        clinicalEncounterId: encounter.id,
        occurredAt: new Date(),
        subjective: 'subjective',
        authorMembershipId: f.membership.id,
      },
    });
    expect('updatedAt' in evolution).toBe(false);
    expect(evolution.clinicalEncounterId).toBe(encounter.id);
  });

  it('allows a record-level evolution without an encounter', async () => {
    const f = await fixture();
    const evolution = await prisma.clinicalEvolution.create({
      data: {
        organizationId: f.organization.id,
        clinicalRecordId: f.record.id,
        occurredAt: new Date(),
        assessment: 'Record-level note',
        authorMembershipId: f.membership.id,
      },
    });
    expect(evolution.clinicalEncounterId).toBeNull();
  });

  it('rejects evolutions that reference another tenant encounter', async () => {
    const f = await fixture();
    const other = await fixture();
    const encounter = await prisma.clinicalEncounter.create({ data: await encounterData(other) });
    await expect(
      prisma.clinicalEvolution.create({
        data: {
          organizationId: f.organization.id,
          clinicalRecordId: f.record.id,
          clinicalEncounterId: encounter.id,
          occurredAt: new Date(),
          authorMembershipId: f.membership.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('requires an author membership from the same tenant for evolutions', async () => {
    const f = await fixture();
    const other = await fixture();
    await expect(
      prisma.clinicalEvolution.create({
        data: {
          organizationId: f.organization.id,
          clinicalRecordId: f.record.id,
          occurredAt: new Date(),
          authorMembershipId: other.membership.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('allows draft vital measurements and keeps numeric checks strict', async () => {
    const f = await fixture();
    const encounter = await prisma.clinicalEncounter.create({ data: await encounterData(f) });
    const vital = await prisma.vitalMeasurement.create({
      data: {
        organizationId: f.organization.id,
        clinicalRecordId: f.record.id,
        clinicalEncounterId: encounter.id,
        patientId: f.patient.id,
        measuredAt: new Date(),
        recordedByMembershipId: f.membership.id,
      },
    });
    expect(vital.weightKg).toBeNull();
    await expect(
      prisma.vitalMeasurement.create({
        data: {
          organizationId: f.organization.id,
          clinicalRecordId: f.record.id,
          clinicalEncounterId: encounter.id,
          patientId: f.patient.id,
          measuredAt: new Date(),
          weightKg: -1,
          recordedByMembershipId: f.membership.id,
        },
      }),
    ).rejects.toThrow('violates check constraint');
  });

  it('rejects non-positive heart and respiratory rates', async () => {
    const f = await fixture();
    const encounter = await prisma.clinicalEncounter.create({ data: await encounterData(f) });
    const base = {
      organizationId: f.organization.id,
      clinicalRecordId: f.record.id,
      clinicalEncounterId: encounter.id,
      patientId: f.patient.id,
      measuredAt: new Date(),
      recordedByMembershipId: f.membership.id,
    };
    await expect(
      prisma.vitalMeasurement.create({ data: { ...base, heartRateBpm: 0 } }),
    ).rejects.toThrow('violates check constraint');
    await expect(
      prisma.vitalMeasurement.create({ data: { ...base, respiratoryRateBpm: 0 } }),
    ).rejects.toThrow('violates check constraint');
  });

  it('requires tenant-safe record, patient, and recorder links for vitals', async () => {
    const f = await fixture();
    const other = await fixture();
    const encounter = await prisma.clinicalEncounter.create({ data: await encounterData(f) });
    const base = {
      organizationId: f.organization.id,
      clinicalRecordId: f.record.id,
      clinicalEncounterId: encounter.id,
      patientId: f.patient.id,
      measuredAt: new Date(),
      recordedByMembershipId: f.membership.id,
    };
    await expect(
      prisma.vitalMeasurement.create({ data: { ...base, patientId: other.patient.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      prisma.vitalMeasurement.create({
        data: { ...base, recordedByMembershipId: other.membership.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('records nullable-actor audit events without destructive cascades', async () => {
    const f = await fixture();
    const event = await prisma.clinicalAuditEvent.create({
      data: {
        organizationId: f.organization.id,
        actorMembershipId: null,
        entityType: 'CLINICAL_RECORD',
        entityId: f.record.id,
        action: 'CREATED',
        metadata: { source: 'test' },
      },
    });
    expect(event.actorMembershipId).toBeNull();
    expect(event.createdAt).toBeInstanceOf(Date);
  });

  it('stores the controlled audit entity and action enums', async () => {
    const f = await fixture();
    const event = await prisma.clinicalAuditEvent.create({
      data: {
        organizationId: f.organization.id,
        entityType: 'VITAL_MEASUREMENT',
        entityId: f.record.id,
        action: 'VITAL_ADDED',
      },
    });
    expect(event.entityType).toBe('VITAL_MEASUREMENT');
    expect(event.action).toBe('VITAL_ADDED');
  });

  it('requires audit events to remain inside their tenant', async () => {
    const f = await fixture();
    const other = await fixture();
    await expect(
      prisma.clinicalAuditEvent.create({
        data: {
          organizationId: f.organization.id,
          actorMembershipId: other.membership.id,
          entityType: 'CLINICAL_RECORD',
          entityId: f.record.id,
          action: 'CREATED',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('prevents deleting a tenant while clinical history remains', async () => {
    const f = await fixture();
    await expect(
      prisma.organization.delete({ where: { id: f.organization.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
