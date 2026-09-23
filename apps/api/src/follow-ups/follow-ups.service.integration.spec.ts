import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { TenantContext } from '../authorization/authorization.types';
import { ClinicalService } from '../clinical/clinical.service';
import { PatientsService } from '../patients/patients.service';
import type { CreateClinicalFollowUpDto } from './follow-ups.dto';
import { FollowUpsService } from './follow-ups.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

// PostgreSQL integration coverage exercises actual row locks, composite tenant relations and lifecycle constraints.
describeDatabase('follow-ups service', () => {
  let prisma: PrismaClient;
  let service: FollowUpsService;
  let clinicalService: ClinicalService;
  let patientsService: PatientsService;
  let organizationId: string;
  let foreignOrganizationId: string;
  let patientId: string;
  let archivedPatientId: string;
  let encounterId: string;
  let foreignEncounterId: string;
  let practitioner: TenantContext;
  let secondPractitioner: TenantContext;
  let assistant: TenantContext;
  let foreignPractitioner: TenantContext;
  let historicalOwnerId: string;
  let foreignMembershipId: string;
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
    followUps: [] as string[],
  };

  // Creates a Patient plus its required Owner and clinical-record parent inside an isolated tenant.
  async function makePatient(targetOrganizationId: string, name: string, ownerName: string) {
    const owner = await prisma.owner.create({
      data: { organizationId: targetOrganizationId, firstName: ownerName, lastName: 'QA' },
    });
    ids.owners.push(owner.id);
    const patient = await prisma.patient.create({
      data: {
        organizationId: targetOrganizationId,
        ownerId: owner.id,
        name,
        nameNormalized: `${name.toLowerCase()} ${suffix}`,
        species: 'DOG',
        currentWeightKg: 8.5,
      },
    });
    ids.patients.push(patient.id);
    const record = await prisma.clinicalRecord.create({
      data: { organizationId: targetOrganizationId, patientId: patient.id },
    });
    ids.records.push(record.id);
    return { patient, owner, record };
  }

  // Creates a same-tenant Encounter whose historical Owner can intentionally differ from the current Patient Owner.
  async function makeEncounter(
    targetOrganizationId: string,
    targetPatientId: string,
    ownerIdAtTime: string,
    actorMembershipId: string,
    locationId: string,
    recordId: string,
  ) {
    const encounter = await prisma.clinicalEncounter.create({
      data: {
        organizationId: targetOrganizationId,
        clinicalRecordId: recordId,
        patientId: targetPatientId,
        ownerIdAtTime,
        clinicLocationId: locationId,
        reason: 'Control de QA ficticio',
        occurredAt: new Date('2035-01-08T15:00:00.000Z'),
        createdByMembershipId: actorMembershipId,
      },
    });
    ids.encounters.push(encounter.id);
    return encounter.id;
  }

  // Produces a finalized source for parent-write concurrency coverage.
  async function makeFinalizedEncounter(): Promise<string> {
    const clinic = await prisma.clinicLocation.findFirstOrThrow({
      where: { id: ids.locations[0]! },
    });
    const record = await prisma.clinicalRecord.findFirstOrThrow({ where: { patientId } });
    const encounter = await makeEncounter(
      organizationId,
      patientId,
      historicalOwnerId,
      practitioner.membershipId,
      clinic.id,
      record.id,
    );
    await prisma.clinicalEncounter.update({
      where: { id: encounter },
      data: {
        status: 'FINALIZED',
        responsibleMembershipId: practitioner.membershipId,
        professionalDisplayNameSnapshot: 'Dra. FollowUps QA 1',
        professionalLicenseSnapshot: 'FUP-QA-1',
        finalizedAt: new Date(),
        finalizedByMembershipId: practitioner.membershipId,
      },
    });
    return encounter;
  }

  // Creates an OPEN task using civil DATE input and an explicit-offset reminder instant.
  async function createFollowUp(
    actor: TenantContext = assistant,
    targetPatientId = patientId,
    overrides: Partial<CreateClinicalFollowUpDto> = {},
  ) {
    const record = await service.create(actor, targetPatientId, {
      title: 'Control de QA',
      dueOn: '2035-01-09',
      reminderAt: '2035-01-09T10:15:00-05:00',
      ...overrides,
    });
    ids.followUps.push(record.id);
    return record;
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL_TEST;
    if (!url) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    service = new FollowUpsService(prisma as never);
    clinicalService = new ClinicalService(prisma as never);
    patientsService = new PatientsService(prisma as never);

    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: {
          name: `FollowUps QA Norte ${suffix}`,
          slug: `followups-qa-norte-${suffix}`,
          timezone: 'America/Bogota',
        },
      }),
      prisma.organization.create({
        data: {
          name: `FollowUps QA Sur ${suffix}`,
          slug: `followups-qa-sur-${suffix}`,
          timezone: 'America/Bogota',
        },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    ids.organizations.push(organizationId, foreignOrganizationId);
    const users = await Promise.all(
      ['practitioner', 'second', 'assistant', 'foreign'].map((name) =>
        prisma.user.create({
          data: {
            email: `followups-${name}-${suffix}@example.local`,
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
          organizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: users[2]!.id,
          organizationId,
          role: 'ASSISTANT',
          clinicalRole: 'CLINICAL_ASSISTANT',
          status: 'ACTIVE',
        },
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
    foreignMembershipId = memberships[3]!.id;
    await Promise.all(
      memberships
        .filter((membership) => membership.clinicalRole === 'PRACTITIONER')
        .map((membership, index) =>
          prisma.membershipProfessionalProfile.create({
            data: {
              organizationId: membership.organizationId,
              membershipId: membership.id,
              displayName: `Dra. FollowUps QA ${index + 1}`,
              licenseNumber: `FUP-QA-${index + 1}`,
            },
          }),
        ),
    );
    practitioner = {
      organizationId,
      membershipId: memberships[0]!.id,
      role: 'VETERINARIAN',
      clinicalRole: 'PRACTITIONER',
      userId: users[0]!.id,
    };
    secondPractitioner = {
      organizationId,
      membershipId: memberships[1]!.id,
      role: 'VETERINARIAN',
      clinicalRole: 'PRACTITIONER',
      userId: users[1]!.id,
    };
    assistant = {
      organizationId,
      membershipId: memberships[2]!.id,
      role: 'ASSISTANT',
      clinicalRole: 'CLINICAL_ASSISTANT',
      userId: users[2]!.id,
    };
    foreignPractitioner = {
      organizationId: foreignOrganizationId,
      membershipId: memberships[3]!.id,
      role: 'VETERINARIAN',
      clinicalRole: 'PRACTITIONER',
      userId: users[3]!.id,
    };
    const [clinic, foreignClinic] = await Promise.all([
      prisma.clinicLocation.create({ data: { organizationId, name: 'FollowUps QA Norte' } }),
      prisma.clinicLocation.create({
        data: { organizationId: foreignOrganizationId, name: 'FollowUps QA Sur' },
      }),
    ]);
    ids.locations.push(clinic.id, foreignClinic.id);
    const [{ patient, owner, record: patientRecord }, archived] = await Promise.all([
      makePatient(organizationId, `Luna FollowUps ${suffix}`, 'Owner Actual'),
      makePatient(organizationId, `Archivo FollowUps ${suffix}`, 'Owner Archivo'),
    ]);
    patientId = patient.id;
    archivedPatientId = archived.patient.id;
    const historicalOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Owner', lastName: 'Histórico' },
    });
    ids.owners.push(historicalOwner.id);
    historicalOwnerId = historicalOwner.id;
    await prisma.patient.update({ where: { id: patientId }, data: { ownerId: owner.id } });
    encounterId = await makeEncounter(
      organizationId,
      patientId,
      historicalOwnerId,
      practitioner.membershipId,
      clinic.id,
      patientRecord.id,
    );
    await makeEncounter(
      organizationId,
      archivedPatientId,
      owner.id,
      practitioner.membershipId,
      clinic.id,
      archived.record.id,
    );
    const foreign = await makePatient(
      foreignOrganizationId,
      `Sur FollowUps ${suffix}`,
      'Owner Sur',
    );
    foreignEncounterId = await makeEncounter(
      foreignOrganizationId,
      foreign.patient.id,
      foreign.owner.id,
      foreignPractitioner.membershipId,
      foreignClinic.id,
      foreign.record.id,
    );
  }, 30_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.clinicalFollowUp.deleteMany({ where: { id: { in: ids.followUps } } });
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
  }, 30_000);

  it('creates tenant-safe OPEN rows with a civil date, reminder instant and clinical-member assignment', async () => {
    const record = await createFollowUp(assistant, patientId, {
      assignedMembershipId: practitioner.membershipId,
      sourceClinicalEncounterId: encounterId,
      notes: 'Contenido privado de QA',
    });
    expect(record.status).toBe('OPEN');
    expect(record.dueOn).toBe('2035-01-09');
    expect(record.reminderAt).toBe('2035-01-09T15:15:00.000Z');
    expect(record.assignedMember?.displayName).toContain('FollowUps QA');
    await expect(service.findOne(foreignPractitioner, record.id)).rejects.toMatchObject({
      response: { code: 'FOLLOW_UP_NOT_FOUND' },
    });
    await expect(
      service.create(assistant, patientId, {
        title: 'Tenant inválido',
        dueOn: '2035-01-09',
        assignedMembershipId: foreignMembershipId,
      }),
    ).rejects.toMatchObject({ response: { code: 'ASSIGNED_MEMBERSHIP_NOT_FOUND' } });
    await expect(
      service.create(assistant, patientId, {
        title: 'Consulta de otro Patient',
        dueOn: '2035-01-09',
        sourceClinicalEncounterId: foreignEncounterId,
      }),
    ).rejects.toMatchObject({ response: { code: 'CLINICAL_ENCOUNTER_NOT_FOUND' } });
  });

  it('completes with historical Owner and Practitioner snapshots, private audit metadata and no synthetic records', async () => {
    const record = await createFollowUp(assistant, patientId, {
      sourceClinicalEncounterId: encounterId,
      assignedMembershipId: secondPractitioner.membershipId,
    });
    const before = await Promise.all([
      prisma.clinicalEncounter.count({ where: { organizationId } }),
      prisma.clinicalEvolution.count({ where: { organizationId } }),
      prisma.appointment.count({ where: { organizationId } }),
      prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: { currentWeightKg: true },
      }),
    ]);
    const completed = await service.complete(practitioner, record.id, {
      expectedVersion: record.version,
      outcome: 'Resultado de seguimiento',
      completionNotes: 'Notas privadas de QA',
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.version).toBe(2);
    expect(completed.patientNameSnapshot).toContain('Luna FollowUps');
    expect(completed.ownerDisplayNameSnapshot).toBe('Owner Histórico');
    expect(completed.professionalDisplayNameSnapshot).toContain('FollowUps QA 1');
    expect(completed.professionalLicenseSnapshot).toBe('FUP-QA-1');
    const after = await Promise.all([
      prisma.clinicalEncounter.count({ where: { organizationId } }),
      prisma.clinicalEvolution.count({ where: { organizationId } }),
      prisma.appointment.count({ where: { organizationId } }),
      prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: { currentWeightKg: true },
      }),
    ]);
    expect(after).toEqual(before);
    const audit = await prisma.clinicalAuditEvent.findFirstOrThrow({
      where: { entityId: record.id, action: 'FOLLOW_UP_COMPLETED' },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain('Resultado de seguimiento');
    expect(JSON.stringify(audit.metadata)).not.toContain('Notas privadas de QA');
    const voided = await service.void(
      practitioner,
      completed.id,
      completed.version,
      'Corrección de QA',
    );
    expect(voided.status).toBe('VOIDED');
    expect(voided.outcome).toBe('Resultado de seguimiento');
    await expect(
      service.update(practitioner, voided.id, {
        expectedVersion: voided.version,
        title: 'No editar',
      }),
    ).rejects.toMatchObject({ response: { code: 'FOLLOW_UP_IMMUTABLE' } });
    const assistantAttempt = await createFollowUp(assistant);
    await expect(
      service.complete(assistant, assistantAttempt.id, {
        expectedVersion: assistantAttempt.version,
        outcome: 'Sin permiso',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('uses compare-and-swap so concurrent edits produce one version increment and one audit', async () => {
    const record = await createFollowUp();
    const before = await prisma.clinicalAuditEvent.count({
      where: { entityId: record.id, action: 'FOLLOW_UP_UPDATED' },
    });
    const results = await Promise.allSettled([
      service.update(assistant, record.id, { expectedVersion: record.version, title: 'Edición A' }),
      service.update(secondPractitioner, record.id, {
        expectedVersion: record.version,
        title: 'Edición B',
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const current = await prisma.clinicalFollowUp.findUniqueOrThrow({ where: { id: record.id } });
    expect(current.version).toBe(2);
    expect(
      await prisma.clinicalAuditEvent.count({
        where: { entityId: record.id, action: 'FOLLOW_UP_UPDATED' },
      }),
    ).toBe(before + 1);
    await expect(
      service.update(assistant, record.id, { expectedVersion: 1, title: 'Edición obsoleta' }),
    ).rejects.toMatchObject({ response: { code: 'FOLLOW_UP_STALE' } });
    await expect(
      service.update(assistant, record.id, { expectedVersion: 2, title: current.title }),
    ).rejects.toMatchObject({ response: { code: 'FOLLOW_UP_NO_CHANGES' } });
  });

  it('allows only one audit winner for PATCH/COMPLETE, COMPLETE/COMPLETE, COMPLETE/VOID and VOID/VOID races', async () => {
    const cases = [
      {
        record: await createFollowUp(),
        writes: (id: string) => [
          service.update(assistant, id, { expectedVersion: 1, title: 'Edición contra complete' }),
          service.complete(practitioner, id, {
            expectedVersion: 1,
            outcome: 'Resultado contra patch',
          }),
        ],
      },
      {
        record: await createFollowUp(),
        writes: (id: string) => [
          service.complete(practitioner, id, { expectedVersion: 1, outcome: 'Resultado A' }),
          service.complete(secondPractitioner, id, { expectedVersion: 1, outcome: 'Resultado B' }),
        ],
      },
      {
        record: await createFollowUp(),
        writes: (id: string) => [
          service.complete(practitioner, id, {
            expectedVersion: 1,
            outcome: 'Resultado contra void',
          }),
          service.void(secondPractitioner, id, 1, 'Void contra complete'),
        ],
      },
      {
        record: await createFollowUp(),
        writes: (id: string) => [
          service.void(practitioner, id, 1, 'Void A'),
          service.void(secondPractitioner, id, 1, 'Void B'),
        ],
      },
    ];

    for (const testCase of cases) {
      const outcomes = await Promise.allSettled(testCase.writes(testCase.record.id));
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(
        await prisma.clinicalAuditEvent.count({
          where: {
            entityId: testCase.record.id,
            action: { in: ['FOLLOW_UP_UPDATED', 'FOLLOW_UP_COMPLETED', 'FOLLOW_UP_VOIDED'] },
          },
        }),
      ).toBe(1);
    }
  });

  it('blocks mutations after Patient archive while preserving read and void access', async () => {
    const record = await createFollowUp(assistant, archivedPatientId);
    await patientsService.archiveForOrganization(organizationId, archivedPatientId);
    await expect(
      service.create(assistant, archivedPatientId, { title: 'Bloqueado', dueOn: '2035-01-09' }),
    ).rejects.toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
    await expect(
      service.update(assistant, record.id, { expectedVersion: 1, title: 'Bloqueado' }),
    ).rejects.toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
    await expect(
      service.complete(practitioner, record.id, { expectedVersion: 1, outcome: 'Bloqueado' }),
    ).rejects.toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
    expect((await service.findOne(practitioner, record.id)).status).toBe('OPEN');
    expect(
      (await service.void(practitioner, record.id, 1, 'Anulación permitida tras archivo')).status,
    ).toBe('VOIDED');
  });

  it('serializes create against Patient archive and rejects every later write', async () => {
    const { patient } = await makePatient(organizationId, `Race Archive ${suffix}`, 'Owner Race');
    const outcomes = await Promise.allSettled([
      service.create(assistant, patient.id, {
        title: 'Create contra archive',
        dueOn: '2035-01-11',
      }),
      patientsService.archiveForOrganization(organizationId, patient.id),
    ]);
    expect(outcomes[1]?.status).toBe('fulfilled');
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).status).toBe(
      'ARCHIVED',
    );
    if (outcomes[0]?.status === 'fulfilled') {
      ids.followUps.push(outcomes[0].value.id);
      await expect(
        service.update(assistant, outcomes[0].value.id, {
          expectedVersion: 1,
          title: 'Write posterior',
        }),
      ).rejects.toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
    } else {
      expect(outcomes[0].reason).toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
    }
  });

  it('retries Encounter NOWAIT contention and resolves create/complete races against parent void', async () => {
    const heldEncounterId = await makeFinalizedEncounter();
    let unlock!: () => void;
    let announceLock!: () => void;
    const lockHeld = new Promise<void>((resolve) => {
      announceLock = resolve;
    });
    const releaseLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const lockTransaction = prisma.$transaction(async (tx) => {
      await tx.clinicalEncounter.update({
        where: { id: heldEncounterId },
        data: { version: { increment: 1 } },
      });
      announceLock();
      await releaseLock;
    });
    await lockHeld;
    const pendingCreate = service.create(assistant, patientId, {
      title: 'Create tras contención ficticia',
      dueOn: '2035-01-12',
      sourceClinicalEncounterId: heldEncounterId,
    });
    setTimeout(unlock, 90);
    const created = await pendingCreate;
    ids.followUps.push(created.id);
    await lockTransaction;
    expect(created.status).toBe('OPEN');

    const createRaceEncounter = await makeFinalizedEncounter();
    const createRaceParent = await prisma.clinicalEncounter.findUniqueOrThrow({
      where: { id: createRaceEncounter },
      select: { version: true },
    });
    const createRace = await Promise.allSettled([
      service.create(assistant, patientId, {
        title: 'Create contra Encounter void',
        dueOn: '2035-01-12',
        sourceClinicalEncounterId: createRaceEncounter,
      }),
      clinicalService.voidEncounter(practitioner, createRaceEncounter, {
        expectedVersion: createRaceParent.version,
        reason: 'Void concurrente QA',
      }),
    ]);
    expect(createRace[1]?.status).toBe('fulfilled');
    if (createRace[0]?.status === 'fulfilled') {
      ids.followUps.push(createRace[0].value.id);
      expect(createRace[0].value.status).toBe('OPEN');
    } else {
      expect(createRace[0].reason).toMatchObject({
        response: { code: 'SOURCE_CLINICAL_ENCOUNTER_VOIDED' },
      });
    }

    const completeRaceEncounter = await makeFinalizedEncounter();
    const linked = await createFollowUp(assistant, patientId, {
      sourceClinicalEncounterId: completeRaceEncounter,
    });
    const completeRaceParent = await prisma.clinicalEncounter.findUniqueOrThrow({
      where: { id: completeRaceEncounter },
      select: { version: true },
    });
    const completeRace = await Promise.allSettled([
      service.complete(practitioner, linked.id, {
        expectedVersion: linked.version,
        outcome: 'Completion contra Encounter void',
      }),
      clinicalService.voidEncounter(practitioner, completeRaceEncounter, {
        expectedVersion: completeRaceParent.version,
        reason: 'Void contra completion QA',
      }),
    ]);
    expect(completeRace[1]?.status).toBe('fulfilled');
    if (completeRace[0]?.status === 'fulfilled') {
      expect(completeRace[0].value.status).toBe('COMPLETED');
      expect((await service.findOne(practitioner, linked.id)).status).toBe('COMPLETED');
    } else {
      expect(completeRace[0].reason).toMatchObject({
        response: { code: 'SOURCE_CLINICAL_ENCOUNTER_VOIDED' },
      });
      expect((await service.findOne(practitioner, linked.id)).status).toBe('OPEN');
    }
  });

  it('preserves a linked follow-up when its source Encounter is voided and disables normal lifecycle writes', async () => {
    const linked = await createFollowUp(assistant, patientId, {
      sourceClinicalEncounterId: encounterId,
    });
    const parent = await prisma.clinicalEncounter.update({
      where: { id: encounterId },
      data: {
        status: 'FINALIZED',
        version: { increment: 1 },
        responsibleMembershipId: practitioner.membershipId,
        professionalDisplayNameSnapshot: 'Dra. FollowUps QA 1',
        professionalLicenseSnapshot: 'FUP-QA-1',
        finalizedAt: new Date(),
        finalizedByMembershipId: practitioner.membershipId,
      },
    });
    await clinicalService.voidEncounter(practitioner, encounterId, {
      expectedVersion: parent.version,
      reason: 'Anulación del Encounter QA',
    });
    await expect(
      service.update(assistant, linked.id, {
        expectedVersion: linked.version,
        title: 'No editable',
      }),
    ).rejects.toMatchObject({ response: { code: 'SOURCE_CLINICAL_ENCOUNTER_VOIDED' } });
    await expect(
      service.complete(practitioner, linked.id, {
        expectedVersion: linked.version,
        outcome: 'No completable',
      }),
    ).rejects.toMatchObject({ response: { code: 'SOURCE_CLINICAL_ENCOUNTER_VOIDED' } });
    expect(
      (
        await service.void(
          practitioner,
          linked.id,
          linked.version,
          'Anulación de seguimiento permitida',
        )
      ).status,
    ).toBe('VOIDED');
  });
});
