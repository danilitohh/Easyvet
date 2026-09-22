import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClinicalProcedureKind, Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import { AppModule } from '../app.module';
import { PasswordService } from '../auth/password.service';
import { ApiExceptionFilter } from '../http/api-exception.filter';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const password = 'Procedure-Test-Password!2026';

// The suite verifies lifecycle and concurrency against an isolated PostgreSQL test database.
describeDatabase('procedures API', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const membershipIds: string[] = [];
  const locationIds: string[] = [];
  const ownerIds: string[] = [];
  const patientIds: string[] = [];
  const recordIds: string[] = [];
  const encounterIds: string[] = [];
  let organizationId: string;
  let foreignOrganizationId: string;
  let locationId: string;
  let foreignLocationId: string;
  let patientId: string;
  let foreignPatientId: string;
  let ownerId: string;
  let practitionerMembershipId: string;
  let assistantMembershipId: string;
  let otherPractitionerMembershipId: string;
  let noProfileMembershipId: string;
  let practitionerEmail: string;
  let assistantEmail: string;
  let otherPractitionerEmail: string;
  let noProfileEmail: string;
  let managerEmail: string;
  let foreignPractitionerEmail: string;

  // Every test identity uses an isolated session so tenant context cannot leak across roles.
  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
    return agent;
  }

  // Each test encounter belongs to the patient’s same-tenant clinical record and historical owner.
  async function createEncounter(targetPatientId = patientId, historicalOwnerId?: string) {
    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: targetPatientId },
      select: { organizationId: true, ownerId: true },
    });
    const targetOrganizationId = patient.organizationId;
    const targetLocationId =
      targetOrganizationId === organizationId ? locationId : foreignLocationId;
    const creatorMembershipId =
      targetOrganizationId === organizationId ? practitionerMembershipId : foreignMembershipId;
    const record = await prisma.clinicalRecord.upsert({
      where: {
        organizationId_patientId: {
          organizationId: targetOrganizationId,
          patientId: targetPatientId,
        },
      },
      update: {},
      create: { organizationId: targetOrganizationId, patientId: targetPatientId },
    });
    recordIds.push(record.id);
    const encounter = await prisma.clinicalEncounter.create({
      data: {
        organizationId: targetOrganizationId,
        clinicalRecordId: record.id,
        patientId: targetPatientId,
        ownerIdAtTime: historicalOwnerId ?? patient.ownerId,
        clinicLocationId: targetLocationId,
        responsibleMembershipId: null,
        status: 'DRAFT',
        version: 1,
        reason: `Procedure integration ${suffix}`,
        occurredAt: new Date('2032-01-01T09:00:00.000Z'),
        createdByMembershipId: creatorMembershipId,
      },
    });
    encounterIds.push(encounter.id);
    return encounter;
  }

  // Route helper records only returned fixture IDs for precise tenant-local cleanup.
  async function createProcedure(
    agent: ReturnType<typeof request.agent>,
    encounterId: string,
    body: Record<string, unknown>,
  ) {
    const response = await agent
      .post(`/api/v1/clinical-encounters/${encounterId}/procedures`)
      .send(body)
      .expect(201);
    return response;
  }

  // Wait until API requests are actually queued on the named PostgreSQL row lock.
  async function waitForLockWaiters(table: 'clinical_encounters' | 'patients', minimum: number) {
    const deadline = Date.now() + 10_000;
    const queryPattern = `%FROM "${table}"%FOR UPDATE%`;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ waiters: number }>>`
        SELECT COUNT(*)::int AS waiters
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query ILIKE ${queryPattern}
      `;
      if ((rows[0]?.waiters ?? 0) >= minimum) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out waiting for ${minimum} ${table} row-lock waiter(s)`);
  }

  // Queue two HTTP operations behind one held row lock, then release them in FIFO order.
  async function queueBehindRowLock(
    table: 'clinical_encounters' | 'patients',
    rowId: string,
    firstRequest: () => Promise<SupertestResponse>,
    secondRequest: () => Promise<SupertestResponse>,
  ): Promise<[SupertestResponse, SupertestResponse]> {
    let firstResponse!: Promise<SupertestResponse>;
    let secondResponse!: Promise<SupertestResponse>;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${Prisma.raw(`"${table}"`)} WHERE "id" = ${rowId}::uuid FOR UPDATE`,
      );
      firstResponse = firstRequest();
      await waitForLockWaiters(table, 1);
      secondResponse = secondRequest();
      await waitForLockWaiters(table, 2);
    });
    return Promise.all([firstResponse, secondResponse]);
  }

  // Use the supported encounter API to establish finalized parent state for void races.
  async function finalizeEncounter(
    agent: ReturnType<typeof request.agent>,
    encounterId: string,
  ): Promise<SupertestResponse> {
    // This fixture is created directly, so supply the same required practitioner as the API flow.
    await prisma.clinicalEncounter.update({
      where: { id: encounterId },
      data: { responsibleMembershipId: practitionerMembershipId },
    });
    return agent
      .post(`/api/v1/clinical-encounters/${encounterId}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
  }

  let foreignMembershipId: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    const passwordHash = await app.get(PasswordService).hash(password);
    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: { name: `Procedure North ${suffix}`, slug: `procedure-north-${suffix}` },
      }),
      prisma.organization.create({
        data: { name: `Procedure South ${suffix}`, slug: `procedure-south-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizationIds.push(organization.id, foreignOrganization.id);
    const [location, foreignLocation] = await Promise.all([
      prisma.clinicLocation.create({ data: { organizationId, name: `Procedure North ${suffix}` } }),
      prisma.clinicLocation.create({
        data: { organizationId: foreignOrganizationId, name: `Procedure South ${suffix}` },
      }),
    ]);
    locationId = location.id;
    foreignLocationId = foreignLocation.id;
    locationIds.push(location.id, foreignLocation.id);

    practitionerEmail = `procedure-practitioner-${suffix}@example.local`;
    assistantEmail = `procedure-assistant-${suffix}@example.local`;
    otherPractitionerEmail = `procedure-other-${suffix}@example.local`;
    noProfileEmail = `procedure-no-profile-${suffix}@example.local`;
    managerEmail = `procedure-manager-${suffix}@example.local`;
    foreignPractitionerEmail = `procedure-foreign-${suffix}@example.local`;
    const identities = await Promise.all(
      [
        practitionerEmail,
        assistantEmail,
        otherPractitionerEmail,
        noProfileEmail,
        managerEmail,
        foreignPractitionerEmail,
      ].map((email) => prisma.user.create({ data: { email, passwordHash } })),
    );
    userIds.push(...identities.map((user) => user.id));
    const memberships = await Promise.all([
      prisma.membership.create({
        data: {
          userId: identities[0]!.id,
          organizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: identities[1]!.id,
          organizationId,
          role: 'ASSISTANT',
          clinicalRole: 'CLINICAL_ASSISTANT',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: identities[2]!.id,
          organizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: identities[3]!.id,
          organizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: identities[4]!.id,
          organizationId,
          role: 'ADMIN',
          clinicalRole: null,
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: identities[5]!.id,
          organizationId: foreignOrganizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
    ]);
    membershipIds.push(...memberships.map((membership) => membership.id));
    practitionerMembershipId = memberships[0]!.id;
    assistantMembershipId = memberships[1]!.id;
    otherPractitionerMembershipId = memberships[2]!.id;
    noProfileMembershipId = memberships[3]!.id;
    foreignMembershipId = memberships[5]!.id;
    await Promise.all([
      prisma.membershipProfessionalProfile.create({
        data: {
          organizationId,
          membershipId: practitionerMembershipId,
          displayName: 'Dra. Proc QA',
          licenseNumber: 'PROC-QA-01',
        },
      }),
      prisma.membershipProfessionalProfile.create({
        data: {
          organizationId,
          membershipId: assistantMembershipId,
          displayName: 'Asistente Proc QA',
        },
      }),
      prisma.membershipProfessionalProfile.create({
        data: {
          organizationId,
          membershipId: otherPractitionerMembershipId,
          displayName: 'Dr. Otro Proc QA',
        },
      }),
    ]);

    const [owner, foreignOwner] = await Promise.all([
      prisma.owner.create({
        data: { organizationId, firstName: 'Propietaria', lastName: `QA ${suffix}` },
      }),
      prisma.owner.create({
        data: {
          organizationId: foreignOrganizationId,
          firstName: 'Otra',
          lastName: `QA ${suffix}`,
        },
      }),
    ]);
    ownerId = owner.id;
    ownerIds.push(owner.id, foreignOwner.id);
    const [patient, foreignPatient] = await Promise.all([
      prisma.patient.create({
        data: {
          organizationId,
          ownerId,
          name: `Paciente ${suffix}`,
          nameNormalized: `paciente ${suffix}`,
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwner.id,
          name: `Paciente Sur ${suffix}`,
          nameNormalized: `paciente sur ${suffix}`,
          species: 'CAT',
        },
      }),
    ]);
    patientId = patient.id;
    foreignPatientId = foreignPatient.id;
    patientIds.push(patient.id, foreignPatient.id);
  }, 30_000);

  afterAll(async () => {
    if (prisma && organizationIds.length) {
      await prisma.clinicalAuditEvent.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.clinicalSurgeryDetail.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.clinicalProcedure.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.clinicalEncounter.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.clinicalRecord.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.patient.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.owner.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.membershipProfessionalProfile.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.membership.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.clinicLocation.deleteMany({ where: { id: { in: locationIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    await app?.close();
    await prisma?.$disconnect();
  }, 30_000);

  it('enforces clinical-role permissions, tenant-safe reads, and kind/detail invariants', async () => {
    const practitioner = await login(practitionerEmail);
    const manager = await login(managerEmail);
    const encounter = await createEncounter();
    const created = await createProcedure(practitioner, encounter.id, {
      kind: 'PROCEDURE',
      procedureName: 'Curación de prueba',
    });
    expect(created.body.version).toBe(1);
    expect(created.body.status).toBe('DRAFT');
    await manager.get(`/api/v1/procedures/${created.body.id}`).expect(403);
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/procedures`)
      .send({ kind: 'PROCEDURE', surgeryDetail: {} })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('SURGERY_DETAIL_NOT_ALLOWED'));
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/procedures`)
      .send({ kind: 'PROCEDURE', organizationId: foreignOrganizationId })
      .expect(400);
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/procedures`)
      .send({ kind: 'PROCEDURE', responsiblePractitionerMembershipId: foreignMembershipId })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('RESPONSIBLE_PRACTITIONER_REQUIRED'));
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/procedures`)
      .send({
        kind: 'SURGERY',
        surgeryDetail: { assistantMembershipId: foreignMembershipId },
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ASSISTANT_PROFILE_REQUIRED'));
    const foreignEncounter = await createEncounter(foreignPatientId);
    await practitioner
      .post(`/api/v1/clinical-encounters/${foreignEncounter.id}/procedures`)
      .send({ kind: 'PROCEDURE' })
      .expect(404);
    await practitioner.get(`/api/v1/patients/${foreignPatientId}/procedures`).expect(404);
    const foreignPractitioner = await login(foreignPractitionerEmail);
    await foreignPractitioner.get(`/api/v1/procedures/${created.body.id}`).expect(404);
  });

  it('keeps surgery detail subordinate and finalizes profile snapshots only once', async () => {
    const practitioner = await login(practitionerEmail);
    const assistant = await login(assistantEmail);
    const otherPractitioner = await login(otherPractitionerEmail);
    const historicalOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Titular histórico', lastName: `QA ${suffix}` },
    });
    ownerIds.push(historicalOwner.id);
    const encounter = await createEncounter(patientId, historicalOwner.id);
    const surgery = await createProcedure(practitioner, encounter.id, {
      kind: 'SURGERY',
      procedureName: 'Surgery QA',
      performedAt: '2032-01-01T09:30:00.000Z',
      responsiblePractitionerMembershipId: practitionerMembershipId,
      surgeryDetail: { assistantMembershipId, surgicalArea: 'Abdomen' },
    });
    expect(surgery.body.surgeryDetail.assistantDisplayNameSnapshot).toBeNull();
    const updated = await assistant
      .patch(`/api/v1/procedures/${surgery.body.id}`)
      .send({ expectedVersion: 1, surgeryDetail: { closureNotes: 'Cierre QA' } })
      .expect(200);
    expect(updated.body.version).toBe(2);
    await assistant
      .post(`/api/v1/procedures/${surgery.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(403);
    await otherPractitioner
      .post(`/api/v1/procedures/${surgery.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('ONLY_RESPONSIBLE_PRACTITIONER_CAN_FINALIZE'));
    const finalized = await practitioner
      .post(`/api/v1/procedures/${surgery.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(201);
    expect(finalized.body.status).toBe('FINALIZED');
    expect(finalized.body.version).toBe(3);
    expect(finalized.body.patientNameSnapshot).toBe(`Paciente ${suffix}`);
    expect(finalized.body.ownerDisplayNameSnapshot).toBe(`Titular histórico QA ${suffix}`);
    expect(finalized.body.professionalDisplayNameSnapshot).toBe('Dra. Proc QA');
    expect(finalized.body.surgeryDetail.assistantDisplayNameSnapshot).toBe('Asistente Proc QA');
    await assistant
      .post(`/api/v1/procedures/${surgery.body.id}/void`)
      .send({ expectedVersion: 3, reason: 'No autorizado' })
      .expect(403);
    await prisma.$transaction([
      prisma.patient.updateMany({
        where: { id: patientId, organizationId },
        data: { name: 'Paciente editado después', nameNormalized: 'paciente editado después' },
      }),
      prisma.owner.updateMany({
        where: { id: historicalOwner.id, organizationId },
        data: { firstName: 'Titular actualizado', lastName: 'Después' },
      }),
      prisma.membershipProfessionalProfile.updateMany({
        where: { membershipId: practitionerMembershipId, organizationId },
        data: { displayName: 'Nombre profesional actualizado', licenseNumber: 'PROC-QA-02' },
      }),
      prisma.membershipProfessionalProfile.updateMany({
        where: { membershipId: assistantMembershipId, organizationId },
        data: { displayName: 'Nombre de asistente actualizado' },
      }),
    ]);
    const historical = await practitioner.get(`/api/v1/procedures/${surgery.body.id}`).expect(200);
    expect(historical.body.patientNameSnapshot).toBe(`Paciente ${suffix}`);
    expect(historical.body.ownerDisplayNameSnapshot).toBe(`Titular histórico QA ${suffix}`);
    expect(historical.body.professionalDisplayNameSnapshot).toBe('Dra. Proc QA');
    expect(historical.body.professionalLicenseSnapshot).toBe('PROC-QA-01');
    expect(historical.body.surgeryDetail.assistantDisplayNameSnapshot).toBe('Asistente Proc QA');
    await prisma.$transaction([
      prisma.patient.updateMany({
        where: { id: patientId, organizationId },
        data: { name: `Paciente ${suffix}`, nameNormalized: `paciente ${suffix}` },
      }),
      prisma.owner.updateMany({
        where: { id: historicalOwner.id, organizationId },
        data: { firstName: 'Titular histórico', lastName: `QA ${suffix}` },
      }),
      prisma.membershipProfessionalProfile.updateMany({
        where: { membershipId: practitionerMembershipId, organizationId },
        data: { displayName: 'Dra. Proc QA', licenseNumber: 'PROC-QA-01' },
      }),
      prisma.membershipProfessionalProfile.updateMany({
        where: { membershipId: assistantMembershipId, organizationId },
        data: { displayName: 'Asistente Proc QA' },
      }),
    ]);
    await practitioner
      .post(`/api/v1/procedures/${surgery.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PROCEDURE_STALE'));
    await assistant
      .patch(`/api/v1/procedures/${surgery.body.id}`)
      .send({ expectedVersion: 3, notes: 'No se debe guardar' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PROCEDURE_IMMUTABLE'));
  });

  it('rejects empty finalization, removes child detail on kind change, and rejects no-op/stale writes', async () => {
    const practitioner = await login(practitionerEmail);
    const noProfile = await login(noProfileEmail);
    const encounter = await createEncounter();
    const surgery = await createProcedure(practitioner, encounter.id, {
      kind: 'SURGERY',
      surgeryDetail: { surgicalArea: 'Extremidad' },
    });
    const changed = await practitioner
      .patch(`/api/v1/procedures/${surgery.body.id}`)
      .send({ expectedVersion: 1, kind: 'PROCEDURE' })
      .expect(200);
    expect(changed.body.kind).toBe('PROCEDURE');
    expect(changed.body.surgeryDetail).toBeNull();
    await practitioner
      .patch(`/api/v1/procedures/${surgery.body.id}`)
      .send({ expectedVersion: 2, notes: null })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PROCEDURE_NO_CHANGES'));
    const missingProfile = await createProcedure(practitioner, encounter.id, {
      kind: 'PROCEDURE',
      procedureName: 'Sin perfil',
      performedAt: '2032-01-01T09:40:00.000Z',
      responsiblePractitionerMembershipId: noProfileMembershipId,
    });
    await noProfile
      .post(`/api/v1/procedures/${missingProfile.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PROFESSIONAL_PROFILE_REQUIRED'));
  });

  it('serializes competing patch, finalize and void requests with one audit event per winner', async () => {
    const practitioner = await login(practitionerEmail);
    const otherPractitioner = await login(otherPractitionerEmail);
    const encounter = await createEncounter();
    const draft = await createProcedure(practitioner, encounter.id, {
      kind: ClinicalProcedureKind.PROCEDURE,
      procedureName: 'Procedimiento concurrente',
      performedAt: '2032-01-01T09:50:00.000Z',
      responsiblePractitionerMembershipId: practitionerMembershipId,
    });
    const patchRequests = await Promise.all([
      practitioner
        .patch(`/api/v1/procedures/${draft.body.id}`)
        .send({ expectedVersion: 1, notes: 'Edición A' }),
      practitioner
        .patch(`/api/v1/procedures/${draft.body.id}`)
        .send({ expectedVersion: 1, indication: 'Indicación B' }),
    ]);
    expect(patchRequests.map((response) => response.status).sort()).toEqual([200, 409]);
    const updated = patchRequests.find((response) => response.status === 200)!;
    const finalizeRequests = await Promise.all([
      practitioner
        .post(`/api/v1/procedures/${draft.body.id}/finalize`)
        .send({ expectedVersion: 2 }),
      practitioner
        .post(`/api/v1/procedures/${draft.body.id}/finalize`)
        .send({ expectedVersion: 2 }),
    ]);
    expect(finalizeRequests.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(finalizeRequests.find((response) => response.status === 409)?.body.code).toBe(
      'PROCEDURE_STALE',
    );
    const finalized = finalizeRequests.find((response) => response.status === 201)!;
    const voidRequests = await Promise.all([
      otherPractitioner
        .post(`/api/v1/procedures/${draft.body.id}/void`)
        .send({ expectedVersion: 3, reason: 'Corrección QA de prueba' }),
      otherPractitioner
        .post(`/api/v1/procedures/${draft.body.id}/void`)
        .send({ expectedVersion: 3, reason: 'Corrección QA duplicada' }),
    ]);
    expect(voidRequests.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(voidRequests.find((response) => response.status === 409)?.body.code).toBe(
      'PROCEDURE_STALE',
    );
    const voided = voidRequests.find((response) => response.status === 201)!;
    expect(updated.body.version).toBe(2);
    expect(finalized.body.status).toBe('FINALIZED');
    expect(voided.body.status).toBe('VOIDED');
    expect(['Corrección QA de prueba', 'Corrección QA duplicada']).toContain(
      voided.body.voidReason,
    );
    const events = await prisma.clinicalAuditEvent.findMany({
      where: { entityType: 'CLINICAL_PROCEDURE', entityId: draft.body.id },
      select: { action: true, metadata: true },
    });
    expect(events.map((event) => event.action).sort()).toEqual([
      'CREATED',
      'FINALIZED',
      'UPDATED',
      'VOIDED',
    ]);
    expect(JSON.stringify(events.map((event) => event.metadata))).not.toContain('Edición A');
    expect(JSON.stringify(events.map((event) => event.metadata))).not.toContain('Edición B');
    const list = await practitioner
      .get(`/api/v1/patients/${patientId}/procedures?status=VOIDED&pageSize=10`)
      .expect(200);
    expect(list.body.data.some((item: { id: string }) => item.id === draft.body.id)).toBe(true);
  });

  it('makes Encounter void win races against procedure create, update and finalize', async () => {
    const practitioner = await login(practitionerEmail);

    // Each operation races against the same parent lifecycle lock using an isolated encounter.
    for (const operation of ['create', 'update', 'finalize'] as const) {
      const encounter = await createEncounter();
      await finalizeEncounter(practitioner, encounter.id);
      let procedureId: string | undefined;
      if (operation !== 'create') {
        const created = await createProcedure(practitioner, encounter.id, {
          kind: 'PROCEDURE',
          procedureName: 'Carrera de atención',
          performedAt: '2032-01-01T10:00:00.000Z',
          responsiblePractitionerMembershipId: practitionerMembershipId,
        });
        procedureId = created.body.id;
      }

      const [voidResponse, mutationResponse] = await queueBehindRowLock(
        'clinical_encounters',
        encounter.id,
        () =>
          practitioner
            .post(`/api/v1/clinical-encounters/${encounter.id}/void`)
            .send({ expectedVersion: 2, reason: `Parent void wins ${operation}` })
            .then((response) => response),
        () => {
          if (operation === 'create') {
            return practitioner
              .post(`/api/v1/clinical-encounters/${encounter.id}/procedures`)
              .send({ kind: 'PROCEDURE' })
              .then((response) => response);
          }
          if (operation === 'update') {
            if (!procedureId) throw new Error('Update race requires a procedure fixture');
            return practitioner
              .patch(`/api/v1/procedures/${procedureId}`)
              .send({ expectedVersion: 1, notes: 'No debe guardarse' })
              .then((response) => response);
          }
          if (!procedureId) throw new Error('Finalize race requires a procedure fixture');
          return practitioner
            .post(`/api/v1/procedures/${procedureId}/finalize`)
            .send({ expectedVersion: 1 })
            .then((response) => response);
        },
      );

      expect(voidResponse.status).toBe(201);
      expect(voidResponse.body.status).toBe('VOIDED');
      expect(mutationResponse.status).toBe(409);
      expect(mutationResponse.body.code).toBe('PARENT_CLINICAL_ENCOUNTER_VOIDED');
      if (operation === 'create') {
        expect(
          await prisma.clinicalProcedure.count({
            where: { organizationId, clinicalEncounterId: encounter.id },
          }),
        ).toBe(0);
      } else {
        if (!procedureId) throw new Error(`${operation} race requires a procedure fixture`);
        const procedure = await prisma.clinicalProcedure.findFirstOrThrow({
          where: { id: procedureId, organizationId },
        });
        expect(procedure.status).toBe('DRAFT');
        expect(procedure.version).toBe(1);
        expect(procedure.notes).toBeNull();
        expect(
          await prisma.clinicalAuditEvent.count({
            where: {
              organizationId,
              entityType: 'CLINICAL_PROCEDURE',
              entityId: procedureId,
            },
          }),
        ).toBe(1);
      }
    }
  }, 30_000);

  it('makes Patient archive win a race against procedure creation', async () => {
    const practitioner = await login(practitionerEmail);
    const manager = await login(managerEmail);
    const encounter = await createEncounter();
    const existingProcedureAuditCount = await prisma.clinicalAuditEvent.count({
      where: { organizationId, entityType: 'CLINICAL_PROCEDURE' },
    });

    // The archive request is queued before creation; the clinical write must re-check Patient state.
    const [archiveResponse, createResponse] = await queueBehindRowLock(
      'patients',
      patientId,
      () => manager.post(`/api/v1/patients/${patientId}/archive`).then((response) => response),
      () =>
        practitioner
          .post(`/api/v1/clinical-encounters/${encounter.id}/procedures`)
          .send({ kind: 'PROCEDURE' })
          .then((response) => response),
    );

    expect(archiveResponse.status).toBe(201);
    expect(archiveResponse.body.status).toBe('ARCHIVED');
    expect(createResponse.status).toBe(409);
    expect(createResponse.body.code).toBe('PATIENT_ARCHIVED');
    expect(
      await prisma.clinicalProcedure.count({
        where: { organizationId, clinicalEncounterId: encounter.id },
      }),
    ).toBe(0);
    expect(
      await prisma.clinicalAuditEvent.count({
        where: { organizationId, entityType: 'CLINICAL_PROCEDURE' },
      }),
    ).toBe(existingProcedureAuditCount);

    // The fixture is restored only after assertions so the suite cleanup remains tenant-safe.
    await prisma.patient.update({
      where: { id: patientId },
      data: { status: 'ACTIVE', archivedAt: null },
    });
  }, 30_000);
});
