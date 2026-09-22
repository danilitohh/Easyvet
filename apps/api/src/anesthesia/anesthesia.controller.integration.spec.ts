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
const password = 'Anesthesia-Test-Password!2026';
type LockTable = 'clinical_encounters' | 'patients' | 'clinical_procedures' | 'anesthesia_records';

// The suite uses real PostgreSQL locks because anesthesia correctness depends on parent races.
describeDatabase('anesthesia API', () => {
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
  let foreignMembershipId: string;
  let practitionerEmail: string;
  let assistantEmail: string;
  let otherPractitionerEmail: string;
  let noProfileEmail: string;
  let managerEmail: string;
  let foreignPractitionerEmail: string;

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
    return agent;
  }

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
        reason: `Anesthesia integration ${suffix}`,
        occurredAt: new Date('2033-02-01T09:00:00.000Z'),
        createdByMembershipId: creatorMembershipId,
      },
    });
    encounterIds.push(encounter.id);
    return encounter;
  }

  async function createProcedure(
    encounterId: string,
    options: {
      kind?: 'PROCEDURE' | 'SURGERY';
      status?: 'DRAFT' | 'FINALIZED' | 'VOIDED';
      patient?: string;
    } = {},
  ) {
    const status = options.status ?? 'DRAFT';
    const targetPatientId = options.patient ?? patientId;
    const base = {
      organizationId,
      clinicalEncounterId: encounterId,
      patientId: targetPatientId,
      kind: options.kind ?? ClinicalProcedureKind.PROCEDURE,
      status,
      version: status === 'DRAFT' ? 1 : status === 'FINALIZED' ? 2 : 3,
      procedureName: `Procedimiento anestesia ${suffix}`,
      performedAt: new Date('2033-02-01T09:30:00.000Z'),
      createdByMembershipId: practitionerMembershipId,
      responsiblePractitionerMembershipId: practitionerMembershipId,
    };
    return prisma.clinicalProcedure.create({
      data: {
        ...base,
        ...(status !== 'DRAFT'
          ? {
              patientNameSnapshot: `Paciente ${suffix}`,
              ownerDisplayNameSnapshot: `Propietaria QA ${suffix}`,
              professionalDisplayNameSnapshot: 'Dra. Anestesia QA',
              professionalLicenseSnapshot: 'AN-QA-01',
              finalizedAt: new Date('2033-02-01T09:45:00.000Z'),
              finalizedByMembershipId: practitionerMembershipId,
            }
          : {}),
        ...(status === 'VOIDED'
          ? {
              voidedAt: new Date('2033-02-01T10:00:00.000Z'),
              voidedByMembershipId: practitionerMembershipId,
              voidReason: 'Fixture voided procedure',
            }
          : {}),
      },
    });
  }

  async function createAnesthesia(
    agent: ReturnType<typeof request.agent>,
    encounterId: string,
    body: Record<string, unknown>,
  ) {
    return agent
      .post(`/api/v1/clinical-encounters/${encounterId}/anesthesia-records`)
      .send(body)
      .expect(201);
  }

  async function finalizeEncounter(agent: ReturnType<typeof request.agent>, encounterId: string) {
    await prisma.clinicalEncounter.update({
      where: { id: encounterId },
      data: { responsibleMembershipId: practitionerMembershipId },
    });
    return agent
      .post(`/api/v1/clinical-encounters/${encounterId}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
  }

  async function waitForLockWaiters(table: LockTable, minimum: number) {
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

  async function queueBehindRowLock(
    table: LockTable,
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
      // The first API transaction may hold parent locks while it waits for this row, so the
      // second API transaction can queue behind those parent locks instead of this exact row.
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    return Promise.all([firstResponse, secondResponse]);
  }

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
        data: { name: `Anesthesia North ${suffix}`, slug: `anesthesia-north-${suffix}` },
      }),
      prisma.organization.create({
        data: { name: `Anesthesia South ${suffix}`, slug: `anesthesia-south-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizationIds.push(organization.id, foreignOrganization.id);
    const [location, foreignLocation] = await Promise.all([
      prisma.clinicLocation.create({
        data: { organizationId, name: `Anesthesia North ${suffix}` },
      }),
      prisma.clinicLocation.create({
        data: { organizationId: foreignOrganizationId, name: `Anesthesia South ${suffix}` },
      }),
    ]);
    locationId = location.id;
    foreignLocationId = foreignLocation.id;
    locationIds.push(location.id, foreignLocation.id);

    practitionerEmail = `anesthesia-practitioner-${suffix}@example.local`;
    assistantEmail = `anesthesia-assistant-${suffix}@example.local`;
    otherPractitionerEmail = `anesthesia-other-${suffix}@example.local`;
    noProfileEmail = `anesthesia-no-profile-${suffix}@example.local`;
    managerEmail = `anesthesia-manager-${suffix}@example.local`;
    foreignPractitionerEmail = `anesthesia-foreign-${suffix}@example.local`;
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
          displayName: 'Dra. Anestesia QA',
          licenseNumber: 'AN-QA-01',
        },
      }),
      prisma.membershipProfessionalProfile.create({
        data: {
          organizationId,
          membershipId: assistantMembershipId,
          displayName: 'Asistente Anestesia QA',
        },
      }),
      prisma.membershipProfessionalProfile.create({
        data: {
          organizationId,
          membershipId: otherPractitionerMembershipId,
          displayName: 'Dr. Otro Anestesia QA',
        },
      }),
    ]);

    const [owner, foreignOwner] = await Promise.all([
      prisma.owner.create({
        data: { organizationId, firstName: 'Propietaria', lastName: `Anestesia ${suffix}` },
      }),
      prisma.owner.create({
        data: {
          organizationId: foreignOrganizationId,
          firstName: 'Otra',
          lastName: `Anestesia ${suffix}`,
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
          name: `Paciente Anestesia ${suffix}`,
          nameNormalized: `paciente anestesia ${suffix}`,
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwner.id,
          name: `Paciente Sur Anestesia ${suffix}`,
          nameNormalized: `paciente sur anestesia ${suffix}`,
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
      await prisma.anesthesiaObservation.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.anesthesiaRecord.deleteMany({
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

  it('enforces role permissions, tenant isolation, and procedure link consistency', async () => {
    const practitioner = await login(practitionerEmail);
    const manager = await login(managerEmail);
    const foreignPractitioner = await login(foreignPractitionerEmail);
    const encounter = await createEncounter();
    const linkedProcedure = await createProcedure(encounter.id, { kind: 'PROCEDURE' });
    const created = await createAnesthesia(practitioner, encounter.id, {
      clinicalProcedureId: linkedProcedure.id,
      startedAt: '2033-02-01T09:35:00.000Z',
      technique: 'Técnica QA',
    });

    expect(created.body.status).toBe('DRAFT');
    expect(created.body.version).toBe(1);
    expect(created.body.linkedProcedureStatus).toBe('DRAFT');
    await manager.get(`/api/v1/anesthesia-records/${created.body.id}`).expect(403);
    await foreignPractitioner.get(`/api/v1/anesthesia-records/${created.body.id}`).expect(404);
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
      .send({ organizationId: foreignOrganizationId })
      .expect(400);

    const otherEncounter = await createEncounter();
    const wrongEncounterProcedure = await createProcedure(otherEncounter.id);
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
      .send({ clinicalProcedureId: wrongEncounterProcedure.id })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('PROCEDURE_NOT_FOUND'));

    const foreignEncounter = await createEncounter(foreignPatientId);
    const foreignProcedure = await prisma.clinicalProcedure.create({
      data: {
        organizationId: foreignOrganizationId,
        clinicalEncounterId: foreignEncounter.id,
        patientId: foreignPatientId,
        kind: 'SURGERY',
        status: 'DRAFT',
        version: 1,
        procedureName: 'Foreign surgery',
        createdByMembershipId: foreignMembershipId,
      },
    });
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
      .send({ clinicalProcedureId: foreignProcedure.id })
      .expect(404);

    const voidedProcedure = await createProcedure(encounter.id, { status: 'VOIDED' });
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
      .send({ clinicalProcedureId: voidedProcedure.id })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PARENT_CLINICAL_PROCEDURE_VOIDED'));

    const list = await practitioner
      .get(`/api/v1/patients/${patientId}/anesthesia-records?status=DRAFT&pageSize=10`)
      .expect(200);
    expect(list.body.data.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
    await practitioner.get(`/api/v1/patients/${foreignPatientId}/anesthesia-records`).expect(404);
  });

  it('updates drafts, relinks procedures, and performs observation CRUD with parent CAS', async () => {
    const practitioner = await login(practitionerEmail);
    const encounter = await createEncounter();
    const procedureA = await createProcedure(encounter.id);
    const procedureB = await createProcedure(encounter.id, {
      kind: 'SURGERY',
      status: 'FINALIZED',
    });
    const record = await createAnesthesia(practitioner, encounter.id, {
      clinicalProcedureId: procedureA.id,
      startedAt: '2033-02-01T10:00:00.000Z',
      endedAt: '2033-02-01T10:20:00.000Z',
      responsiblePractitionerMembershipId: practitionerMembershipId,
    });
    const relinked = await practitioner
      .patch(`/api/v1/anesthesia-records/${record.body.id}`)
      .send({ expectedVersion: 1, clinicalProcedureId: procedureB.id, notes: 'Relink QA' })
      .expect(200);
    expect(relinked.body.version).toBe(2);
    expect(relinked.body.clinicalProcedureId).toBe(procedureB.id);
    const cleared = await practitioner
      .patch(`/api/v1/anesthesia-records/${record.body.id}`)
      .send({ expectedVersion: 2, clinicalProcedureId: null, asaClassification: null })
      .expect(200);
    expect(cleared.body.version).toBe(3);
    expect(cleared.body.clinicalProcedureId).toBeNull();
    await practitioner
      .patch(`/api/v1/anesthesia-records/${record.body.id}`)
      .send({ expectedVersion: 3 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ANESTHESIA_NO_CHANGES'));

    await practitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/observations`)
      .send({ expectedVersion: 3, observedAt: '2033-02-01T10:10:00.000Z' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ANESTHESIA_OBSERVATION_EMPTY'));
    const first = await practitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/observations`)
      .send({
        expectedVersion: 3,
        observedAt: '2033-02-01T10:10:00.000Z',
        respiratoryRatePerMinute: 0,
        spo2Percent: 100,
        etco2MmHg: 0,
      })
      .expect(201);
    expect(first.body.anesthesiaRecordVersion).toBe(4);
    expect(first.body.observation.respiratoryRatePerMinute).toBe(0);
    const second = await practitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/observations`)
      .send({
        expectedVersion: 4,
        observedAt: '2033-02-01T10:05:00.000Z',
        anestheticPlane: 'Plano QA',
      })
      .expect(201);
    expect(second.body.anesthesiaRecordVersion).toBe(5);
    const updated = await practitioner
      .patch(
        `/api/v1/anesthesia-records/${record.body.id}/observations/${second.body.observation.id}`,
      )
      .send({
        expectedVersion: 5,
        observedAt: '2033-02-01T10:04:00.000Z',
        anestheticPlane: null,
        notes: 'Nota QA',
      })
      .expect(200);
    expect(updated.body.anesthesiaRecordVersion).toBe(6);
    await practitioner
      .patch(
        `/api/v1/anesthesia-records/${record.body.id}/observations/${updated.body.observation.id}`,
      )
      .send({ expectedVersion: 6, notes: null })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ANESTHESIA_OBSERVATION_EMPTY'));
    const ordered = await practitioner
      .get(`/api/v1/anesthesia-records/${record.body.id}/observations?pageSize=10`)
      .expect(200);
    expect(ordered.body.data.map((item: { id: string }) => item.id)).toEqual([
      updated.body.observation.id,
      first.body.observation.id,
    ]);
    const removed = await practitioner
      .delete(
        `/api/v1/anesthesia-records/${record.body.id}/observations/${updated.body.observation.id}?expectedVersion=6`,
      )
      .expect(200);
    expect(removed.body.anesthesiaRecordVersion).toBe(7);
    await practitioner
      .delete(
        `/api/v1/anesthesia-records/${record.body.id}/observations/${first.body.observation.id}?expectedVersion=6`,
      )
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ANESTHESIA_STALE'));
  });

  it('finalizes with historical snapshots, rejects invalid responsible actors, and allows void corrections', async () => {
    const practitioner = await login(practitionerEmail);
    const assistant = await login(assistantEmail);
    const otherPractitioner = await login(otherPractitionerEmail);
    const historicalOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Titular histórico', lastName: `Anestesia ${suffix}` },
    });
    ownerIds.push(historicalOwner.id);
    const encounter = await createEncounter(patientId, historicalOwner.id);
    const empty = await createAnesthesia(practitioner, encounter.id, {});
    await practitioner
      .post(`/api/v1/anesthesia-records/${empty.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ANESTHESIA_STARTED_AT_REQUIRED'));

    const noProfileRecord = await createAnesthesia(practitioner, encounter.id, {
      startedAt: '2033-02-01T11:00:00.000Z',
      responsiblePractitionerMembershipId: noProfileMembershipId,
    });
    const noProfile = await login(noProfileEmail);
    await noProfile
      .post(`/api/v1/anesthesia-records/${noProfileRecord.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PROFESSIONAL_PROFILE_REQUIRED'));

    const record = await createAnesthesia(practitioner, encounter.id, {
      startedAt: '2033-02-01T11:10:00.000Z',
      responsiblePractitionerMembershipId: practitionerMembershipId,
    });
    await assistant
      .post(`/api/v1/anesthesia-records/${record.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(403);
    await otherPractitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('ONLY_RESPONSIBLE_PRACTITIONER_CAN_FINALIZE'));
    const finalized = await practitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
    expect(finalized.body.status).toBe('FINALIZED');
    expect(finalized.body.version).toBe(2);
    expect(finalized.body.patientNameSnapshot).toBe(`Paciente Anestesia ${suffix}`);
    expect(finalized.body.ownerDisplayNameSnapshot).toBe(`Titular histórico Anestesia ${suffix}`);
    expect(finalized.body.professionalDisplayNameSnapshot).toBe('Dra. Anestesia QA');

    await prisma.$transaction([
      prisma.patient.updateMany({
        where: { id: patientId, organizationId },
        data: { name: 'Paciente editado', nameNormalized: 'paciente editado' },
      }),
      prisma.owner.updateMany({
        where: { id: historicalOwner.id, organizationId },
        data: { firstName: 'Titular actualizado', lastName: 'Después' },
      }),
      prisma.membershipProfessionalProfile.updateMany({
        where: { membershipId: practitionerMembershipId, organizationId },
        data: { displayName: 'Nombre profesional actualizado', licenseNumber: 'AN-QA-02' },
      }),
    ]);
    const historical = await practitioner
      .get(`/api/v1/anesthesia-records/${record.body.id}`)
      .expect(200);
    expect(historical.body.patientNameSnapshot).toBe(`Paciente Anestesia ${suffix}`);
    expect(historical.body.ownerDisplayNameSnapshot).toBe(`Titular histórico Anestesia ${suffix}`);
    expect(historical.body.professionalLicenseSnapshot).toBe('AN-QA-01');
    await practitioner
      .patch(`/api/v1/anesthesia-records/${record.body.id}`)
      .send({ expectedVersion: 2, notes: 'No mutable' })
      .expect(409);
    await practitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/observations`)
      .send({
        expectedVersion: 2,
        observedAt: '2033-02-01T11:20:00.000Z',
        notes: 'No mutable',
      })
      .expect(409);
    await prisma.patient.update({
      where: { id: patientId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    const voided = await otherPractitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/void`)
      .send({ expectedVersion: 2, reason: 'Corrección histórica QA' })
      .expect(201);
    expect(voided.body.status).toBe('VOIDED');
    await prisma.patient.update({
      where: { id: patientId },
      data: {
        name: `Paciente Anestesia ${suffix}`,
        nameNormalized: `paciente anestesia ${suffix}`,
        status: 'ACTIVE',
        archivedAt: null,
      },
    });
    await prisma.membershipProfessionalProfile.updateMany({
      where: { membershipId: practitionerMembershipId, organizationId },
      data: { displayName: 'Dra. Anestesia QA', licenseNumber: 'AN-QA-01' },
    });
  });

  it('validates time inputs and required clinical minimums without requiring endedAt or observations', async () => {
    const practitioner = await login(practitionerEmail);
    const encounter = await createEncounter();
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
      .send({ startedAt: '2033-02-01T12:00:00' })
      .expect(400);
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
      .send({
        startedAt: '2033-02-01T12:30:00.000Z',
        endedAt: '2033-02-01T12:00:00.000Z',
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('INVALID_ANESTHESIA_TIME_RANGE'));
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
      .send({
        startedAt: '2033-02-01T12:00:00.000Z',
        responsiblePractitionerMembershipId: assistantMembershipId,
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('RESPONSIBLE_PRACTITIONER_REQUIRED'));
    const record = await createAnesthesia(practitioner, encounter.id, {
      startedAt: '2033-02-01T12:00:00-05:00',
      responsiblePractitionerMembershipId: practitionerMembershipId,
    });
    const finalized = await practitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
    expect(finalized.body.status).toBe('FINALIZED');
    expect(finalized.body.endedAt).toBeNull();
    expect(finalized.body.observationCount).toBe(0);
  });

  it('serializes anesthesia CAS, observation/finalize races, and emits private audit metadata', async () => {
    const practitioner = await login(practitionerEmail);
    const otherPractitioner = await login(otherPractitionerEmail);
    const encounter = await createEncounter();
    const record = await createAnesthesia(practitioner, encounter.id, {
      startedAt: '2033-02-01T13:00:00.000Z',
      responsiblePractitionerMembershipId: practitionerMembershipId,
    });
    const patches = await Promise.all([
      practitioner
        .patch(`/api/v1/anesthesia-records/${record.body.id}`)
        .send({ expectedVersion: 1, technique: 'Edición A' }),
      practitioner
        .patch(`/api/v1/anesthesia-records/${record.body.id}`)
        .send({ expectedVersion: 1, notes: 'Edición B' }),
    ]);
    expect(patches.map((response) => response.status).sort()).toEqual([200, 409]);
    await practitioner
      .patch(`/api/v1/anesthesia-records/${record.body.id}`)
      .send({ expectedVersion: 2, technique: 'Lista para finalizar' })
      .expect(200);

    const [finalizeResponse, observationResponse] = await queueBehindRowLock(
      'anesthesia_records',
      record.body.id,
      () =>
        practitioner
          .post(`/api/v1/anesthesia-records/${record.body.id}/finalize`)
          .send({ expectedVersion: 3 })
          .then((response) => response),
      () =>
        practitioner
          .post(`/api/v1/anesthesia-records/${record.body.id}/observations`)
          .send({
            expectedVersion: 3,
            observedAt: '2033-02-01T13:05:00.000Z',
            notes: 'No debe ganar',
          })
          .then((response) => response),
    );
    expect(finalizeResponse.status).toBe(201);
    expect(observationResponse.status).toBe(409);
    expect(['ANESTHESIA_STALE', 'ANESTHESIA_IMMUTABLE']).toContain(observationResponse.body.code);

    const voids = await Promise.all([
      otherPractitioner
        .post(`/api/v1/anesthesia-records/${record.body.id}/void`)
        .send({ expectedVersion: 4, reason: 'Corrección A' }),
      otherPractitioner
        .post(`/api/v1/anesthesia-records/${record.body.id}/void`)
        .send({ expectedVersion: 4, reason: 'Corrección B' }),
    ]);
    expect(voids.map((response) => response.status).sort()).toEqual([201, 409]);
    const events = await prisma.clinicalAuditEvent.findMany({
      where: { organizationId, entityType: 'ANESTHESIA_RECORD', entityId: record.body.id },
      select: { action: true, metadata: true },
    });
    expect(events.map((event) => event.action).sort()).toEqual([
      'CREATED',
      'FINALIZED',
      'UPDATED',
      'UPDATED',
      'VOIDED',
    ]);
    const metadata = JSON.stringify(events.map((event) => event.metadata));
    expect(metadata).not.toContain('Edición A');
    expect(metadata).not.toContain('Edición B');
    expect(metadata).not.toContain('No debe ganar');
  }, 30_000);

  it('makes Encounter void win races against create, update, finalize and observation mutation', async () => {
    const practitioner = await login(practitionerEmail);
    for (const operation of ['create', 'update', 'finalize', 'observation'] as const) {
      const encounter = await createEncounter();
      await finalizeEncounter(practitioner, encounter.id);
      let recordId: string | undefined;
      if (operation !== 'create') {
        const created = await createAnesthesia(practitioner, encounter.id, {
          startedAt: '2033-02-01T14:00:00.000Z',
          responsiblePractitionerMembershipId: practitionerMembershipId,
        });
        recordId = created.body.id;
      }
      const [voidResponse, mutationResponse] = await queueBehindRowLock(
        'clinical_encounters',
        encounter.id,
        () =>
          practitioner
            .post(`/api/v1/clinical-encounters/${encounter.id}/void`)
            .send({ expectedVersion: 2, reason: `Encounter race ${operation}` })
            .then((response) => response),
        () => {
          if (operation === 'create') {
            return practitioner
              .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
              .send({})
              .then((response) => response);
          }
          if (!recordId) throw new Error(`${operation} race requires a record`);
          if (operation === 'update') {
            return practitioner
              .patch(`/api/v1/anesthesia-records/${recordId}`)
              .send({ expectedVersion: 1, notes: 'No debe guardar' })
              .then((response) => response);
          }
          if (operation === 'finalize') {
            return practitioner
              .post(`/api/v1/anesthesia-records/${recordId}/finalize`)
              .send({ expectedVersion: 1 })
              .then((response) => response);
          }
          return practitioner
            .post(`/api/v1/anesthesia-records/${recordId}/observations`)
            .send({
              expectedVersion: 1,
              observedAt: '2033-02-01T14:05:00.000Z',
              notes: 'No debe guardar',
            })
            .then((response) => response);
        },
      );
      expect(voidResponse.status).toBe(201);
      expect(mutationResponse.status).toBe(409);
      expect(mutationResponse.body.code).toBe('PARENT_CLINICAL_ENCOUNTER_VOIDED');
    }
  }, 45_000);

  it('makes Procedure void win races against linked anesthesia mutations', async () => {
    const practitioner = await login(practitionerEmail);
    for (const operation of ['create', 'update', 'finalize', 'observation'] as const) {
      const encounter = await createEncounter();
      const procedure = await createProcedure(encounter.id, { status: 'FINALIZED' });
      let recordId: string | undefined;
      if (operation !== 'create') {
        const created = await createAnesthesia(practitioner, encounter.id, {
          clinicalProcedureId: procedure.id,
          startedAt: '2033-02-01T15:00:00.000Z',
          responsiblePractitionerMembershipId: practitionerMembershipId,
        });
        recordId = created.body.id;
      }
      const [voidResponse, mutationResponse] = await queueBehindRowLock(
        'clinical_procedures',
        procedure.id,
        () =>
          practitioner
            .post(`/api/v1/procedures/${procedure.id}/void`)
            .send({ expectedVersion: 2, reason: `Procedure race ${operation}` })
            .then((response) => response),
        () => {
          if (operation === 'create') {
            return practitioner
              .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
              .send({ clinicalProcedureId: procedure.id })
              .then((response) => response);
          }
          if (!recordId) throw new Error(`${operation} race requires a record`);
          if (operation === 'update') {
            return practitioner
              .patch(`/api/v1/anesthesia-records/${recordId}`)
              .send({ expectedVersion: 1, notes: 'No debe guardar' })
              .then((response) => response);
          }
          if (operation === 'finalize') {
            return practitioner
              .post(`/api/v1/anesthesia-records/${recordId}/finalize`)
              .send({ expectedVersion: 1 })
              .then((response) => response);
          }
          return practitioner
            .post(`/api/v1/anesthesia-records/${recordId}/observations`)
            .send({
              expectedVersion: 1,
              observedAt: '2033-02-01T15:05:00.000Z',
              notes: 'No debe guardar',
            })
            .then((response) => response);
        },
      );
      expect(voidResponse.status).toBe(201);
      expect(mutationResponse.status).toBe(409);
      expect(mutationResponse.body.code).toBe('PARENT_CLINICAL_PROCEDURE_VOIDED');
    }
  }, 45_000);

  it('makes Patient archive win races against anesthesia activity and keeps terminal parent voids historical', async () => {
    const practitioner = await login(practitionerEmail);
    const manager = await login(managerEmail);
    for (const operation of ['create', 'update', 'finalize', 'observation'] as const) {
      const encounter = await createEncounter();
      let recordId: string | undefined;
      if (operation !== 'create') {
        const created = await createAnesthesia(practitioner, encounter.id, {
          startedAt: '2033-02-01T16:00:00.000Z',
          responsiblePractitionerMembershipId: practitionerMembershipId,
        });
        recordId = created.body.id;
      }
      const [archiveResponse, mutationResponse] = await queueBehindRowLock(
        'patients',
        patientId,
        () => manager.post(`/api/v1/patients/${patientId}/archive`).then((response) => response),
        () => {
          if (operation === 'create') {
            return practitioner
              .post(`/api/v1/clinical-encounters/${encounter.id}/anesthesia-records`)
              .send({})
              .then((response) => response);
          }
          if (!recordId) throw new Error(`${operation} race requires a record`);
          if (operation === 'update') {
            return practitioner
              .patch(`/api/v1/anesthesia-records/${recordId}`)
              .send({ expectedVersion: 1, notes: 'No debe guardar' })
              .then((response) => response);
          }
          if (operation === 'finalize') {
            return practitioner
              .post(`/api/v1/anesthesia-records/${recordId}/finalize`)
              .send({ expectedVersion: 1 })
              .then((response) => response);
          }
          return practitioner
            .post(`/api/v1/anesthesia-records/${recordId}/observations`)
            .send({
              expectedVersion: 1,
              observedAt: '2033-02-01T16:05:00.000Z',
              notes: 'No debe guardar',
            })
            .then((response) => response);
        },
      );
      expect(archiveResponse.status).toBe(201);
      expect(mutationResponse.status).toBe(409);
      expect(mutationResponse.body.code).toBe('PATIENT_ARCHIVED');
      await prisma.patient.update({
        where: { id: patientId },
        data: { status: 'ACTIVE', archivedAt: null },
      });
    }

    const encounter = await createEncounter();
    const procedure = await createProcedure(encounter.id, { status: 'FINALIZED' });
    const record = await createAnesthesia(practitioner, encounter.id, {
      clinicalProcedureId: procedure.id,
      startedAt: '2033-02-01T16:30:00.000Z',
      responsiblePractitionerMembershipId: practitionerMembershipId,
    });
    const finalized = await practitioner
      .post(`/api/v1/anesthesia-records/${record.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
    await practitioner
      .post(`/api/v1/procedures/${procedure.id}/void`)
      .send({ expectedVersion: 2, reason: 'Void after anesthesia finalized' })
      .expect(201);
    const detail = await practitioner
      .get(`/api/v1/anesthesia-records/${record.body.id}`)
      .expect(200);
    expect(detail.body.status).toBe('FINALIZED');
    expect(detail.body.linkedProcedureStatus).toBe('VOIDED');
    expect(finalized.body.status).toBe('FINALIZED');
  }, 60_000);
});
