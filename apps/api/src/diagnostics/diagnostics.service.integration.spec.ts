import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { TenantContext } from '../authorization/authorization.types';
import { ClinicalService } from '../clinical/clinical.service';
import { PatientsService } from '../patients/patients.service';
import { DiagnosticsService } from './diagnostics.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

// PostgreSQL coverage proves the diagnostic lifecycle, tenant boundary, snapshots, archive policy and CAS races.
describeDatabase('diagnostics service', () => {
  let prisma: PrismaClient;
  let service: DiagnosticsService;
  let clinicalService: ClinicalService;
  let patientsService: PatientsService;
  let organizationId: string;
  let foreignOrganizationId: string;
  let patientId: string;
  let encounterId: string;
  let practitioner: TenantContext;
  let secondPractitioner: TenantContext;
  let assistant: TenantContext;
  let foreignPractitioner: TenantContext;
  let foreignOrderId: string;
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

  async function makeEncounter(
    targetOrganizationId: string,
    targetPatientId: string,
    actorMembershipId: string,
  ) {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { id: targetPatientId, organizationId: targetOrganizationId },
      select: { ownerId: true },
    });
    const location = await prisma.clinicLocation.create({
      data: { organizationId: targetOrganizationId, name: 'Diagnostics integration clinic' },
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
        reason: 'Diagnostics integration encounter',
        occurredAt: new Date('2035-01-08T15:00:00.000Z'),
        createdByMembershipId: actorMembershipId,
      },
    });
    ids.encounters.push(encounter.id);
    return encounter.id;
  }

  // Archive scenarios get a separate Patient so subsequent CAS cases stay active.
  async function makeAdditionalPatientEncounter() {
    const owner = await prisma.owner.create({
      data: { organizationId, firstName: 'Archivo', lastName: 'QA' },
    });
    ids.owners.push(owner.id);
    const patient = await prisma.patient.create({
      data: {
        organizationId,
        ownerId: owner.id,
        name: `Patient Archive QA ${ids.patients.length}`,
        nameNormalized: `patient archive qa ${ids.patients.length}`,
        species: 'DOG',
      },
    });
    ids.patients.push(patient.id);
    return {
      patientId: patient.id,
      encounterId: await makeEncounter(organizationId, patient.id, practitioner.membershipId),
    };
  }

  // Produces a valid finalized parent so integration races invoke the real Encounter void service.
  async function finalizeEncounter(targetEncounterId: string) {
    return prisma.clinicalEncounter.update({
      where: { id: targetEncounterId },
      data: {
        status: 'FINALIZED',
        version: { increment: 1 },
        responsibleMembershipId: practitioner.membershipId,
        professionalDisplayNameSnapshot: 'Dra. Diagnostics QA 1',
        professionalLicenseSnapshot: 'DIAG-QA-1',
        finalizedAt: new Date(),
        finalizedByMembershipId: practitioner.membershipId,
      },
    });
  }

  // Asserts a parent close wins or follows the diagnostic write without leaving an invalid partial state.
  async function raceDiagnosticAgainstEncounterVoid(
    targetEncounterId: string,
    diagnosticWrite: () => Promise<unknown>,
  ) {
    const parent = await finalizeEncounter(targetEncounterId);
    const outcomes = await Promise.allSettled([
      diagnosticWrite(),
      clinicalService.voidEncounter(practitioner, targetEncounterId, {
        expectedVersion: parent.version,
        reason: 'Cierre de Encounter concurrente QA',
      }),
    ]);
    expect(outcomes[1]?.status).toBe('fulfilled');
    if (outcomes[0]?.status === 'rejected') {
      expect(outcomes[0].reason).toMatchObject({
        response: { code: 'PARENT_CLINICAL_ENCOUNTER_VOIDED' },
      });
    }
    expect(
      (await prisma.clinicalEncounter.findUniqueOrThrow({ where: { id: targetEncounterId } }))
        .status,
    ).toBe('VOIDED');
  }

  // Archive may follow an earlier serialized clinical write, but a write after archive must reject.
  async function raceDiagnosticAgainstPatientArchive(
    targetPatientId: string,
    diagnosticWrite: () => Promise<unknown>,
  ) {
    const outcomes = await Promise.allSettled([
      diagnosticWrite(),
      patientsService.archiveForOrganization(organizationId, targetPatientId),
    ]);
    expect(outcomes[1]?.status).toBe('fulfilled');
    if (outcomes[0]?.status === 'rejected') {
      expect(outcomes[0].reason).toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
    }
    expect(
      (await prisma.patient.findUniqueOrThrow({ where: { id: targetPatientId } })).status,
    ).toBe('ARCHIVED');
  }

  async function createDraft(
    actor: TenantContext = assistant,
    targetEncounterId = encounterId,
    ready = false,
  ) {
    let order = await service.create(actor, targetEncounterId, { category: 'LABORATORY' });
    if (ready) {
      order = await service.updateDraft(actor, order.id, {
        expectedVersion: order.version,
        testName: 'Hemograma de QA',
        requestedAt: '2035-01-08T15:00:00.000Z',
        reason: 'Control ficticio',
        responsiblePractitionerMembershipId: practitioner.membershipId,
      });
    }
    return order;
  }

  async function createRequested(targetEncounterId = encounterId) {
    const draft = await createDraft(assistant, targetEncounterId, true);
    return service.request(practitioner, draft.id, draft.version);
  }

  async function expectSingleRaceWinner(
    first: () => Promise<unknown>,
    second: () => Promise<unknown>,
    orderId: string,
  ) {
    const auditBefore = await prisma.clinicalAuditEvent.count({
      where: { organizationId, entityId: orderId, entityType: 'DIAGNOSTIC_ORDER' },
    });
    const outcomes = await Promise.allSettled([first(), second()]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.clinicalAuditEvent.count({
        where: { organizationId, entityId: orderId, entityType: 'DIAGNOSTIC_ORDER' },
      }),
    ).toBe(auditBefore + 1);
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL_TEST;
    if (!url) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    service = new DiagnosticsService(prisma as never);
    clinicalService = new ClinicalService(prisma as never);
    patientsService = new PatientsService(prisma as never);

    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: {
          name: `Diagnostics QA Norte ${suffix}`,
          slug: `diagnostics-qa-norte-${suffix}`,
          timezone: 'America/Bogota',
        },
      }),
      prisma.organization.create({
        data: { name: `Diagnostics QA Sur ${suffix}`, slug: `diagnostics-qa-sur-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    ids.organizations.push(organizationId, foreignOrganizationId);
    const userData = ['practitioner', 'second-practitioner', 'assistant', 'foreign'].map(
      (name) => ({
        email: `diagnostics-${name}-${suffix}@example.local`,
        passwordHash: 'integration-only',
      }),
    );
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
    await Promise.all(
      memberships
        .filter((membership) => membership.clinicalRole === 'PRACTITIONER')
        .map((membership, index) =>
          prisma.membershipProfessionalProfile.create({
            data: {
              organizationId: membership.organizationId,
              membershipId: membership.id,
              displayName: `Dra. Diagnostics QA ${index + 1}`,
              licenseNumber: `DIAG-QA-${index + 1}`,
            },
          }),
        ),
    );
    const [owner, foreignOwner] = await Promise.all([
      prisma.owner.create({
        data: { organizationId, firstName: 'Camila', lastName: 'Histórica' },
      }),
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
          name: 'Luna Diagnostics QA',
          nameNormalized: 'luna diagnostics qa',
          species: 'DOG',
          currentWeightKg: 11.25,
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwner.id,
          name: 'Sur Diagnostics QA',
          nameNormalized: 'sur diagnostics qa',
          species: 'CAT',
        },
      }),
    ]);
    patientId = patient.id;
    ids.patients.push(patient.id, foreignPatient.id);
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
    encounterId = await makeEncounter(organizationId, patient.id, practitioner.membershipId);
    const foreignEncounterId = await makeEncounter(
      foreignOrganizationId,
      foreignPatient.id,
      foreignPractitioner.membershipId,
    );
    foreignOrderId = (await createDraft(foreignPractitioner, foreignEncounterId)).id;
  }, 30_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.diagnosticOrder.deleteMany({
      where: { organizationId: { in: ids.organizations } },
    });
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

  it('creates and updates Drafts, freezes the historical Owner at request, and accepts a later result from another Practitioner', async () => {
    const initialWeight = (await prisma.patient.findUniqueOrThrow({ where: { id: patientId } }))
      .currentWeightKg;
    const sideEffectCountsBefore = await Promise.all([
      prisma.appointment.count({ where: { organizationId } }),
      prisma.prescription.count({ where: { organizationId } }),
      prisma.vaccination.count({ where: { organizationId } }),
      prisma.deworming.count({ where: { organizationId } }),
      prisma.clinicalProcedure.count({ where: { organizationId } }),
      prisma.anesthesiaRecord.count({ where: { organizationId } }),
      prisma.hospitalization.count({ where: { organizationId } }),
    ]);
    const draft = await createDraft();
    expect(draft.status).toBe('DRAFT');
    const prepared = await service.updateDraft(assistant, draft.id, {
      expectedVersion: draft.version,
      category: 'PATHOLOGY',
      testName: 'Citología de QA',
      requestedAt: '2035-01-08T15:00:00.000Z',
      reason: 'Contenido privado de solicitud',
      instructions: 'Contenido privado de instrucciones',
      responsiblePractitionerMembershipId: practitioner.membershipId,
    });
    await expect(service.findOne(foreignPractitioner, draft.id)).rejects.toMatchObject({
      response: { code: 'DIAGNOSTIC_ORDER_NOT_FOUND' },
    });
    await expect(service.findOne(practitioner, foreignOrderId)).rejects.toMatchObject({
      response: { code: 'DIAGNOSTIC_ORDER_NOT_FOUND' },
    });

    const replacementOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Propietario', lastName: 'Actual' },
    });
    ids.owners.push(replacementOwner.id);
    await prisma.patient.update({
      where: { id: patientId },
      data: { ownerId: replacementOwner.id },
    });
    const requested = await service.request(practitioner, prepared.id, prepared.version);
    expect(requested.status).toBe('REQUESTED');
    expect(requested.patientNameSnapshot).toBe('Luna Diagnostics QA');
    expect(requested.ownerDisplayNameSnapshot).toBe('Camila Histórica');
    expect(requested.professionalDisplayNameSnapshot).toBe('Dra. Diagnostics QA 1');
    expect(requested.requestedByMembershipId).toBe(practitioner.membershipId);
    await expect(
      service.updateDraft(assistant, requested.id, {
        expectedVersion: requested.version,
        testName: 'Alteración después de solicitar',
      }),
    ).rejects.toMatchObject({ response: { code: 'DIAGNOSTIC_ORDER_IMMUTABLE' } });

    const resulted = await service.result(secondPractitioner, requested.id, {
      expectedVersion: requested.version,
      resultedAt: '2035-01-09T15:00:00.000Z',
      resultText: 'Resultado clínico ficticio',
      interpretation: null,
    });
    expect(resulted.status).toBe('RESULTED');
    expect(resulted.resultedByMembershipId).toBe(secondPractitioner.membershipId);
    expect(resulted.ownerDisplayNameSnapshot).toBe('Camila Histórica');
    const audit = await prisma.clinicalAuditEvent.findMany({
      where: { organizationId, entityId: draft.id, entityType: 'DIAGNOSTIC_ORDER' },
      select: { metadata: true },
    });
    const auditText = JSON.stringify(audit.map((event) => event.metadata));
    expect(auditText).not.toContain('Citología de QA');
    expect(auditText).not.toContain('Contenido privado');
    expect(auditText).not.toContain('Luna Diagnostics QA');
    expect(auditText).not.toContain('Camila Histórica');
    expect(
      (await prisma.patient.findUniqueOrThrow({ where: { id: patientId } })).currentWeightKg,
    ).toEqual(initialWeight);
    expect(
      await Promise.all([
        prisma.appointment.count({ where: { organizationId } }),
        prisma.prescription.count({ where: { organizationId } }),
        prisma.vaccination.count({ where: { organizationId } }),
        prisma.deworming.count({ where: { organizationId } }),
        prisma.clinicalProcedure.count({ where: { organizationId } }),
        prisma.anesthesiaRecord.count({ where: { organizationId } }),
        prisma.hospitalization.count({ where: { organizationId } }),
      ]),
    ).toEqual(sideEffectCountsBefore);
  });

  it('rejects empty results and keeps requested/resulted records historical when parent or patient closes', async () => {
    const requestedEncounter = await makeEncounter(
      organizationId,
      patientId,
      practitioner.membershipId,
    );
    const finalizedRequestedEncounter = await finalizeEncounter(requestedEncounter);
    const requested = await createRequested(requestedEncounter);
    await expect(
      service.result(practitioner, requested.id, {
        expectedVersion: requested.version,
        resultedAt: '2035-01-09T15:00:00.000Z',
        resultText: '  ',
        interpretation: null,
      }),
    ).rejects.toMatchObject({ response: { code: 'DIAGNOSTIC_ORDER_RESULT_EMPTY' } });
    await clinicalService.voidEncounter(practitioner, requestedEncounter, {
      expectedVersion: finalizedRequestedEncounter.version,
      reason: 'QA parent closure',
    });
    await expect(
      service.result(practitioner, requested.id, {
        expectedVersion: requested.version,
        resultedAt: '2035-01-09T15:00:00.000Z',
        resultText: 'Late result',
      }),
    ).rejects.toMatchObject({ response: { code: 'PARENT_CLINICAL_ENCOUNTER_VOIDED' } });
    expect((await service.findOne(practitioner, requested.id)).status).toBe('REQUESTED');

    const resultedEncounter = await makeEncounter(
      organizationId,
      patientId,
      practitioner.membershipId,
    );
    await finalizeEncounter(resultedEncounter);
    const anotherRequested = await createRequested(resultedEncounter);
    const resulted = await service.result(practitioner, anotherRequested.id, {
      expectedVersion: anotherRequested.version,
      resultedAt: '2035-01-09T15:00:00.000Z',
      interpretation: 'Interpretación ficticia',
    });
    const finalizedResultedEncounter = await prisma.clinicalEncounter.findUniqueOrThrow({
      where: { id: resultedEncounter },
    });
    await clinicalService.voidEncounter(practitioner, resultedEncounter, {
      expectedVersion: finalizedResultedEncounter.version,
      reason: 'QA parent closure',
    });
    expect((await service.findOne(practitioner, resulted.id)).status).toBe('RESULTED');
  });

  it('serializes CREATE, UPDATE, REQUEST and RESULT against actual Encounter void', async () => {
    const createEncounter = await makeEncounter(
      organizationId,
      patientId,
      practitioner.membershipId,
    );
    await raceDiagnosticAgainstEncounterVoid(createEncounter, () =>
      service.create(assistant, createEncounter, { category: 'IMAGING' }),
    );

    const updateEncounter = await makeEncounter(
      organizationId,
      patientId,
      practitioner.membershipId,
    );
    const updateDraft = await createDraft(assistant, updateEncounter);
    await raceDiagnosticAgainstEncounterVoid(updateEncounter, () =>
      service.updateDraft(assistant, updateDraft.id, {
        expectedVersion: updateDraft.version,
        notes: 'Edición concurrente con anulación de consulta',
      }),
    );

    const requestEncounter = await makeEncounter(
      organizationId,
      patientId,
      practitioner.membershipId,
    );
    const requestDraft = await createDraft(assistant, requestEncounter, true);
    await raceDiagnosticAgainstEncounterVoid(requestEncounter, () =>
      service.request(practitioner, requestDraft.id, requestDraft.version),
    );

    const resultEncounter = await makeEncounter(
      organizationId,
      patientId,
      practitioner.membershipId,
    );
    const requested = await createRequested(resultEncounter);
    await raceDiagnosticAgainstEncounterVoid(resultEncounter, () =>
      service.result(practitioner, requested.id, {
        expectedVersion: requested.version,
        resultedAt: '2035-01-09T15:00:00.000Z',
        resultText: 'Resultado concurrente ficticio',
      }),
    );
  });

  it('serializes CREATE, UPDATE, REQUEST and RESULT against Patient archive', async () => {
    const createFixture = await makeAdditionalPatientEncounter();
    await raceDiagnosticAgainstPatientArchive(createFixture.patientId, () =>
      service.create(assistant, createFixture.encounterId, { category: 'LABORATORY' }),
    );

    const updateFixture = await makeAdditionalPatientEncounter();
    const updateDraft = await createDraft(assistant, updateFixture.encounterId);
    await raceDiagnosticAgainstPatientArchive(updateFixture.patientId, () =>
      service.updateDraft(assistant, updateDraft.id, {
        expectedVersion: updateDraft.version,
        notes: 'Edición concurrente con archive',
      }),
    );

    const requestFixture = await makeAdditionalPatientEncounter();
    const requestDraft = await createDraft(assistant, requestFixture.encounterId, true);
    await raceDiagnosticAgainstPatientArchive(requestFixture.patientId, () =>
      service.request(practitioner, requestDraft.id, requestDraft.version),
    );

    const resultFixture = await makeAdditionalPatientEncounter();
    const requested = await createRequested(resultFixture.encounterId);
    await raceDiagnosticAgainstPatientArchive(resultFixture.patientId, () =>
      service.result(practitioner, requested.id, {
        expectedVersion: requested.version,
        resultedAt: '2035-01-09T15:00:00.000Z',
        resultText: 'Resultado concurrente ficticio',
      }),
    );
  });

  it('blocks writes for archived patients but retains reads and permits Practitioner void', async () => {
    const archivedFixture = await makeAdditionalPatientEncounter();
    const archivedEncounter = archivedFixture.encounterId;
    const requested = await createRequested(archivedEncounter);
    await prisma.patient.update({
      where: { id: archivedFixture.patientId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await expect(createDraft(assistant, archivedEncounter)).rejects.toMatchObject({
      response: { code: 'PATIENT_ARCHIVED' },
    });
    await expect(
      service.updateDraft(assistant, requested.id, {
        expectedVersion: requested.version,
        notes: 'blocked while archived',
      }),
    ).rejects.toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
    await expect(
      service.result(practitioner, requested.id, {
        expectedVersion: requested.version,
        resultedAt: '2035-01-09T15:00:00.000Z',
        resultText: 'blocked while archived',
      }),
    ).rejects.toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
    expect((await service.findOne(practitioner, requested.id)).status).toBe('REQUESTED');
    const voided = await service.void(practitioner, requested.id, {
      expectedVersion: requested.version,
      reason: 'Corrección ficticia después de archivar',
    });
    expect(voided.status).toBe('VOIDED');
  });

  it('serializes PATCH/PATCH and PATCH/REQUEST with one audit winner', async () => {
    const patchDraft = await createDraft();
    await expectSingleRaceWinner(
      () => service.updateDraft(assistant, patchDraft.id, { expectedVersion: 1, notes: 'A' }),
      () => service.updateDraft(assistant, patchDraft.id, { expectedVersion: 1, notes: 'B' }),
      patchDraft.id,
    );

    const patchRequestDraft = await createDraft(assistant, encounterId, true);
    await expectSingleRaceWinner(
      () =>
        service.updateDraft(assistant, patchRequestDraft.id, {
          expectedVersion: patchRequestDraft.version,
          notes: 'Concurrent edit',
        }),
      () => service.request(practitioner, patchRequestDraft.id, patchRequestDraft.version),
      patchRequestDraft.id,
    );
  });

  it('serializes REQUEST/REQUEST, RESULT/RESULT, RESULT/VOID and VOID/VOID', async () => {
    const requestRaceDraft = await createDraft(assistant, encounterId, true);
    await expectSingleRaceWinner(
      () => service.request(practitioner, requestRaceDraft.id, requestRaceDraft.version),
      () => service.request(practitioner, requestRaceDraft.id, requestRaceDraft.version),
      requestRaceDraft.id,
    );

    const resultRace = await createRequested();
    const resultInput = {
      expectedVersion: resultRace.version,
      resultedAt: '2035-01-09T15:00:00.000Z',
      resultText: 'Concurrencia ficticia',
    };
    await expectSingleRaceWinner(
      () => service.result(practitioner, resultRace.id, resultInput),
      () => service.result(secondPractitioner, resultRace.id, resultInput),
      resultRace.id,
    );

    const resultVoidRace = await createRequested();
    await expectSingleRaceWinner(
      () =>
        service.result(practitioner, resultVoidRace.id, {
          expectedVersion: resultVoidRace.version,
          resultedAt: '2035-01-09T15:00:00.000Z',
          resultText: 'Concurrencia ficticia',
        }),
      () =>
        service.void(secondPractitioner, resultVoidRace.id, {
          expectedVersion: resultVoidRace.version,
          reason: 'Anulación concurrente de QA',
        }),
      resultVoidRace.id,
    );

    const voidRace = await createRequested();
    await expectSingleRaceWinner(
      () =>
        service.void(practitioner, voidRace.id, {
          expectedVersion: voidRace.version,
          reason: 'Anulación concurrente A',
        }),
      () =>
        service.void(secondPractitioner, voidRace.id, {
          expectedVersion: voidRace.version,
          reason: 'Anulación concurrente B',
        }),
      voidRace.id,
    );
  });
});
