import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../app.module';
import { ApiExceptionFilter } from '../http/api-exception.filter';
import { PasswordService } from '../auth/password.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const password = 'Prescription-Test-Password!2026';

// This suite exercises the complete backend aggregate against PostgreSQL, including races.
describeDatabase('prescriptions API', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const membershipIds: string[] = [];
  const ownerIds: string[] = [];
  const patientIds: string[] = [];
  const encounterIds: string[] = [];
  const recordIds: string[] = [];
  const locationIds: string[] = [];
  const prescriptionIds: string[] = [];
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
  let ownerEmail: string;
  let groomerEmail: string;
  let cashierEmail: string;
  let platformAdminEmail: string;
  let foreignPractitionerEmail: string;
  let foreignMembershipId: string;

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
    return agent;
  }

  async function createEncounter(
    options: {
      status?: 'DRAFT' | 'FINALIZED' | 'VOIDED';
      patientId?: string;
      responsibleMembershipId?: string | null;
      reason?: string;
      presumptiveDiagnosis?: string | null;
    } = {},
  ) {
    const targetPatientId = options.patientId ?? patientId;
    const targetOwner = await prisma.patient.findUniqueOrThrow({
      where: { id: targetPatientId },
      select: { organizationId: true, ownerId: true },
    });
    const targetOrganizationId = targetOwner.organizationId;
    const targetLocationId =
      targetOrganizationId === organizationId ? locationId : foreignLocationId;
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
    const status = options.status ?? 'DRAFT';
    const encounter = await prisma.clinicalEncounter.create({
      data: {
        organizationId: targetOrganizationId,
        clinicalRecordId: record.id,
        patientId: targetPatientId,
        ownerIdAtTime: targetOwner.ownerId,
        clinicLocationId: targetLocationId,
        responsibleMembershipId: options.responsibleMembershipId ?? null,
        status,
        version: status === 'DRAFT' ? 1 : 2,
        reason: options.reason ?? `Prescription integration ${suffix}`,
        presumptiveDiagnosis: options.presumptiveDiagnosis ?? 'Presuntivo de prueba',
        professionalDisplayNameSnapshot: status === 'DRAFT' ? null : 'Dr. Prescription Original',
        professionalLicenseSnapshot: status === 'DRAFT' ? null : 'LIC-ORIGINAL',
        finalizedAt: status === 'DRAFT' ? null : new Date('2032-01-01T10:00:00.000Z'),
        finalizedByMembershipId:
          status === 'DRAFT' ? null : (options.responsibleMembershipId ?? practitionerMembershipId),
        voidedAt: status === 'VOIDED' ? new Date('2032-01-01T11:00:00.000Z') : null,
        voidedByMembershipId: status === 'VOIDED' ? practitionerMembershipId : null,
        voidReason: status === 'VOIDED' ? 'Anulación de prueba' : null,
        occurredAt: new Date('2032-01-01T09:00:00.000Z'),
        createdByMembershipId:
          targetOrganizationId === organizationId ? practitionerMembershipId : foreignMembershipId,
      },
    });
    encounterIds.push(encounter.id);
    return encounter;
  }

  async function createPrescription(
    agent: ReturnType<typeof request.agent>,
    encounterId: string,
    body: Record<string, unknown> = {},
  ) {
    const response = await agent
      .post(`/api/v1/clinical-encounters/${encounterId}/prescriptions`)
      .send(body)
      .expect(201);
    prescriptionIds.push(response.body.id as string);
    return response;
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
        data: { name: `Prescription North ${suffix}`, slug: `prescription-north-${suffix}` },
      }),
      prisma.organization.create({
        data: { name: `Prescription South ${suffix}`, slug: `prescription-south-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizationIds.push(organization.id, foreignOrganization.id);
    const [location, foreignLocation] = await Promise.all([
      prisma.clinicLocation.create({ data: { organizationId, name: 'Prescription North' } }),
      prisma.clinicLocation.create({
        data: { organizationId: foreignOrganizationId, name: 'Prescription South' },
      }),
    ]);
    locationId = location.id;
    foreignLocationId = foreignLocation.id;
    locationIds.push(location.id, foreignLocation.id);

    practitionerEmail = `prescription-practitioner-${suffix}@example.local`;
    assistantEmail = `prescription-assistant-${suffix}@example.local`;
    otherPractitionerEmail = `prescription-other-${suffix}@example.local`;
    ownerEmail = `prescription-owner-${suffix}@example.local`;
    groomerEmail = `prescription-groomer-${suffix}@example.local`;
    cashierEmail = `prescription-cashier-${suffix}@example.local`;
    platformAdminEmail = `prescription-platform-${suffix}@example.local`;
    const users = await Promise.all(
      [
        practitionerEmail,
        assistantEmail,
        otherPractitionerEmail,
        ownerEmail,
        groomerEmail,
        cashierEmail,
        platformAdminEmail,
      ].map((email) => prisma.user.create({ data: { email, passwordHash } })),
    );
    userIds.push(...users.map((user) => user.id));
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
        data: {
          userId: users[2]!.id,
          organizationId,
          role: 'VETERINARIAN',
          clinicalRole: 'PRACTITIONER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: users[3]!.id,
          organizationId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: users[4]!.id,
          organizationId,
          role: 'GROOMER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: users[5]!.id,
          organizationId,
          role: 'CASHIER',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: users[6]!.id,
          organizationId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
    ]);
    membershipIds.push(...memberships.map((membership) => membership.id));
    practitionerMembershipId = memberships[0]!.id;
    assistantMembershipId = memberships[1]!.id;
    otherPractitionerMembershipId = memberships[2]!.id;
    noProfileMembershipId = memberships[2]!.id;
    await prisma.membershipProfessionalProfile.createMany({
      data: [
        {
          organizationId,
          membershipId: practitionerMembershipId,
          displayName: 'Dr. Prescription Original',
          licenseNumber: 'LIC-ORIGINAL',
        },
        {
          organizationId,
          membershipId: otherPractitionerMembershipId,
          displayName: 'Dr. Other Practitioner',
          licenseNumber: 'LIC-OTHER',
        },
      ],
    });
    foreignPractitionerEmail = `prescription-foreign-${suffix}@example.local`;
    const foreignUser = await prisma.user.create({
      data: { email: foreignPractitionerEmail, passwordHash },
    });
    const foreignMembership = await prisma.membership.create({
      data: {
        userId: foreignUser.id,
        organizationId: foreignOrganizationId,
        role: 'VETERINARIAN',
        clinicalRole: 'PRACTITIONER',
        status: 'ACTIVE',
      },
    });
    userIds.push(foreignUser.id);
    membershipIds.push(foreignMembership.id);
    foreignMembershipId = foreignMembership.id;

    const [owner, foreignOwner] = await Promise.all([
      prisma.owner.create({ data: { organizationId, firstName: 'Original', lastName: 'Owner' } }),
      prisma.owner.create({
        data: { organizationId: foreignOrganizationId, firstName: 'Foreign', lastName: 'Owner' },
      }),
    ]);
    ownerId = owner.id;
    ownerIds.push(owner.id, foreignOwner.id);
    const [patient, foreignPatient] = await Promise.all([
      prisma.patient.create({
        data: {
          organizationId,
          ownerId: owner.id,
          name: 'Prescription Patient',
          nameNormalized: 'prescription patient',
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwner.id,
          name: 'Foreign Prescription Patient',
          nameNormalized: 'foreign prescription patient',
          species: 'CAT',
        },
      }),
    ]);
    patientId = patient.id;
    foreignPatientId = foreignPatient.id;
    patientIds.push(patient.id, foreignPatient.id);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.prescriptionItem.deleteMany({
      where: { prescription: { organizationId: { in: organizationIds } } },
    });
    await prisma.prescription.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.clinicalAuditEvent.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.clinicalEncounter.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.clinicalRecord.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.membershipProfessionalProfile.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    await prisma.owner.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.membership.deleteMany({ where: { id: { in: membershipIds } } });
    await prisma.clinicLocation.deleteMany({ where: { id: { in: locationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app?.close();
    await prisma.$disconnect();
  });

  it('creates and edits a draft, then finalizes with immutable snapshots and ordered items', async () => {
    const practitioner = await login(practitionerEmail);
    const encounter = await createEncounter({ presumptiveDiagnosis: 'Paciente estable' });
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/prescriptions`)
      .send({ patientId, items: [] })
      .expect(400);
    const created = await createPrescription(practitioner, encounter.id, {
      prescribedByMembershipId: practitionerMembershipId,
      items: [],
    });
    expect(created.body.patientId).toBe(patientId);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.items).toHaveLength(0);
    expect(created.body.itemCount).toBe(0);

    await practitioner
      .patch(`/api/v1/prescriptions/${created.body.id}`)
      .send({
        expectedVersion: 1,
        prescribedByMembershipId: practitionerMembershipId,
        items: [
          {
            position: 1,
            medicationName: '  Medicamento B ',
            quantity: '10 tabletas',
            dosage: '1/2 tableta',
            frequency: 'Cada 8 horas',
            duration: '7 días',
          },
          {
            position: 0,
            medicationName: 'Medicamento A',
            presentation: 'Suspensión',
            observations: 'Aplicar con alimento',
          },
        ],
      })
      .expect(200);
    const finalized = await practitioner
      .post(`/api/v1/prescriptions/${created.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(201);
    expect(finalized.body.status).toBe('FINALIZED');
    expect(finalized.body.items.map((item: { position: number }) => item.position)).toEqual([0, 1]);
    expect(finalized.body.itemCount).toBe(2);
    expect(finalized.body.professionalDisplayNameSnapshot).toBe('Dr. Prescription Original');
    expect(finalized.body.patientNameSnapshot).toBe('Prescription Patient');
    expect(finalized.body.ownerDisplayNameSnapshot).toBe('Original Owner');
    expect(finalized.body.diagnosisSnapshot).toContain('Presuntivo: Paciente estable');

    await prisma.patient.update({ where: { id: patientId }, data: { name: 'Patient Renamed' } });
    await prisma.owner.update({ where: { id: ownerId }, data: { firstName: 'Owner Renamed' } });
    await prisma.membershipProfessionalProfile.update({
      where: { membershipId: practitionerMembershipId },
      data: { displayName: 'Dr. Profile Changed', licenseNumber: 'LIC-CHANGED' },
    });
    const historical = await practitioner
      .get(`/api/v1/prescriptions/${created.body.id}`)
      .expect(200);
    expect(historical.body.patientNameSnapshot).toBe('Prescription Patient');
    expect(historical.body.ownerDisplayNameSnapshot).toBe('Original Owner');
    expect(historical.body.professionalDisplayNameSnapshot).toBe('Dr. Prescription Original');
    expect(historical.body.professionalLicenseSnapshot).toBe('LIC-ORIGINAL');
    expect(
      await prisma.clinicalAuditEvent.count({
        where: { entityType: 'PRESCRIPTION', entityId: created.body.id },
      }),
    ).toBe(3);
  });

  it('allows creation on a finalized encounter and rejects missing finalization requirements', async () => {
    const practitioner = await login(practitionerEmail);
    const finalizedEncounter = await createEncounter({ status: 'FINALIZED' });
    const draft = await createPrescription(practitioner, finalizedEncounter.id);
    await practitioner
      .post(`/api/v1/prescriptions/${draft.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PRESCRIBER_REQUIRED'));
    await practitioner
      .patch(`/api/v1/prescriptions/${draft.body.id}`)
      .send({
        expectedVersion: 1,
        prescribedByMembershipId: practitionerMembershipId,
        items: [],
      })
      .expect(200);
    await practitioner
      .post(`/api/v1/prescriptions/${draft.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PRESCRIPTION_ITEMS_REQUIRED'));

    const noProfileUser = await prisma.user.create({
      data: {
        email: `no-profile-${suffix}@example.local`,
        passwordHash: await app.get(PasswordService).hash(password),
      },
    });
    const noProfile = await prisma.membership.create({
      data: {
        userId: noProfileUser.id,
        organizationId,
        role: 'VETERINARIAN',
        clinicalRole: 'PRACTITIONER',
        status: 'ACTIVE',
      },
    });
    userIds.push(noProfileUser.id);
    membershipIds.push(noProfile.id);
    noProfileMembershipId = noProfile.id;
    const noProfileDraft = await createPrescription(practitioner, finalizedEncounter.id, {
      prescribedByMembershipId: noProfileMembershipId,
      items: [{ position: 0, medicationName: 'Perfil ausente' }],
    });
    const noProfileAgent = await login(`no-profile-${suffix}@example.local`);
    await noProfileAgent
      .post(`/api/v1/prescriptions/${noProfileDraft.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PRESCRIBER_PROFILE_REQUIRED'));
  });

  it('lets assistants create/update drafts but never finalize or void them', async () => {
    const assistant = await login(assistantEmail);
    const encounter = await createEncounter();
    const created = await createPrescription(assistant, encounter.id);
    expect(created.body.createdByMembershipId).toBe(assistantMembershipId);
    await assistant
      .patch(`/api/v1/prescriptions/${created.body.id}`)
      .send({
        expectedVersion: 1,
        items: [{ position: 0, medicationName: 'Asistente draft' }],
      })
      .expect(200);
    await assistant
      .post(`/api/v1/prescriptions/${created.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(403);
    await assistant
      .post(`/api/v1/prescriptions/${created.body.id}/void`)
      .send({ expectedVersion: 2, reason: 'No permitido' })
      .expect(403);
  });

  it('requires the prescriber actor, preserves parent void semantics and enforces immutability', async () => {
    const practitioner = await login(practitionerEmail);
    const otherPractitioner = await login(otherPractitionerEmail);
    const encounter = await createEncounter({ status: 'FINALIZED' });
    const created = await createPrescription(practitioner, encounter.id, {
      prescribedByMembershipId: practitionerMembershipId,
      items: [{ position: 0, medicationName: 'Prescriber check' }],
    });
    await otherPractitioner
      .post(`/api/v1/prescriptions/${created.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ONLY_PRESCRIBER_CAN_FINALIZE'));
    await practitioner
      .post(`/api/v1/prescriptions/${created.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
    const voided = await practitioner
      .post(`/api/v1/prescriptions/${created.body.id}/void`)
      .send({ expectedVersion: 2, reason: 'Corrección clínica de prueba' })
      .expect(201);
    expect(voided.body.status).toBe('VOIDED');
    expect(voided.body.items).toHaveLength(1);
    await practitioner
      .patch(`/api/v1/prescriptions/${created.body.id}`)
      .send({ expectedVersion: 3, items: [{ position: 0, medicationName: 'Mutación' }] })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PRESCRIPTION_IMMUTABLE'));

    const historicalFinal = await createPrescription(practitioner, encounter.id, {
      prescribedByMembershipId: practitionerMembershipId,
      items: [{ position: 0, medicationName: 'Historical final' }],
    });
    await practitioner
      .post(`/api/v1/prescriptions/${historicalFinal.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
    const parentDraft = await createPrescription(practitioner, encounter.id, {
      prescribedByMembershipId: practitionerMembershipId,
      items: [{ position: 0, medicationName: 'Parent void draft' }],
    });
    const parentVoid = await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/void`)
      .send({ expectedVersion: 2, reason: 'Encounter anulado para QA' })
      .expect(201);
    expect(parentVoid.body.status).toBe('VOIDED');
    const historical = await practitioner
      .get(`/api/v1/prescriptions/${created.body.id}`)
      .expect(200);
    expect(historical.body.status).toBe('VOIDED');
    expect(historical.body.parentEncounterStatus).toBe('VOIDED');
    const historicalFinalDetail = await practitioner
      .get(`/api/v1/prescriptions/${historicalFinal.body.id}`)
      .expect(200);
    expect(historicalFinalDetail.body.status).toBe('FINALIZED');
    expect(historicalFinalDetail.body.parentEncounterStatus).toBe('VOIDED');
    await practitioner
      .patch(`/api/v1/prescriptions/${parentDraft.body.id}`)
      .send({ expectedVersion: 1, items: [{ position: 0, medicationName: 'No edit' }] })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PARENT_CLINICAL_ENCOUNTER_VOIDED'));
    await practitioner
      .post(`/api/v1/prescriptions/${parentDraft.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PARENT_CLINICAL_ENCOUNTER_VOIDED'));
  });

  it('enforces roles, archived patients and cross-tenant isolation', async () => {
    const practitioner = await login(practitionerEmail);
    const encounter = await createEncounter();
    const created = await createPrescription(practitioner, encounter.id);
    for (const email of [ownerEmail, groomerEmail, cashierEmail, platformAdminEmail]) {
      const agent = await login(email);
      await agent.get(`/api/v1/prescriptions/${created.body.id}`).expect(403);
    }
    await practitioner.get(`/api/v1/patients/${foreignPatientId}/prescriptions`).expect(404);
    await practitioner.get(`/api/v1/prescriptions/${created.body.id}`).expect(200);
    const foreignAgent = await login(foreignPractitionerEmail);
    const foreignEncounter = await createEncounter({
      patientId: foreignPatientId,
      responsibleMembershipId: foreignMembershipId,
    });
    const foreignPrescription = await createPrescription(foreignAgent, foreignEncounter.id, {
      prescribedByMembershipId: foreignMembershipId,
    });
    await practitioner.get(`/api/v1/prescriptions/${foreignPrescription.body.id}`).expect(404);
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/prescriptions`)
      .send({ prescribedByMembershipId: foreignMembershipId })
      .expect(404);
    await practitioner
      .post(`/api/v1/clinical-encounters/${foreignEncounter.id}/prescriptions`)
      .send({})
      .expect(404);

    await prisma.patient.update({
      where: { id: patientId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/prescriptions`)
      .send({ items: [] })
      .expect(404);
    await practitioner.get(`/api/v1/prescriptions/${created.body.id}`).expect(200);
    await practitioner.get(`/api/v1/patients/${patientId}/prescriptions`).expect(200);
    await prisma.patient.update({
      where: { id: patientId },
      data: { status: 'ACTIVE', archivedAt: null },
    });
  });

  it('rejects stale draft writes and allows exactly one winner for finalize and void races', async () => {
    const practitioner = await login(practitionerEmail);
    const encounter = await createEncounter();
    const draft = await createPrescription(practitioner, encounter.id, {
      prescribedByMembershipId: practitionerMembershipId,
      items: [],
    });
    const updateResponses = await Promise.all([
      practitioner
        .patch(`/api/v1/prescriptions/${draft.body.id}`)
        .send({ expectedVersion: 1, items: [{ position: 0, medicationName: 'Race A' }] }),
      practitioner
        .patch(`/api/v1/prescriptions/${draft.body.id}`)
        .send({ expectedVersion: 1, items: [{ position: 0, medicationName: 'Race B' }] }),
    ]);
    expect(updateResponses.map((response) => response.status).sort()).toEqual([200, 409]);
    const afterUpdate = await practitioner
      .get(`/api/v1/prescriptions/${draft.body.id}`)
      .expect(200);
    expect(afterUpdate.body.version).toBe(2);
    expect(afterUpdate.body.items).toHaveLength(1);

    const finalizeResponses = await Promise.all([
      practitioner
        .post(`/api/v1/prescriptions/${draft.body.id}/finalize`)
        .send({ expectedVersion: 2 }),
      practitioner
        .post(`/api/v1/prescriptions/${draft.body.id}/finalize`)
        .send({ expectedVersion: 2 }),
    ]);
    expect(finalizeResponses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.clinicalAuditEvent.count({
        where: {
          entityType: 'PRESCRIPTION',
          entityId: draft.body.id,
          action: 'PRESCRIPTION_FINALIZED',
        },
      }),
    ).toBe(1);

    const voidResponses = await Promise.all([
      practitioner
        .post(`/api/v1/prescriptions/${draft.body.id}/void`)
        .send({ expectedVersion: 3, reason: 'Race void A' }),
      practitioner
        .post(`/api/v1/prescriptions/${draft.body.id}/void`)
        .send({ expectedVersion: 3, reason: 'Race void B' }),
    ]);
    expect(voidResponses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.clinicalAuditEvent.count({
        where: {
          entityType: 'PRESCRIPTION',
          entityId: draft.body.id,
          action: 'PRESCRIPTION_VOIDED',
        },
      }),
    ).toBe(1);
  });

  it('lists by patient with pagination, status and encounter filters', async () => {
    const practitioner = await login(practitionerEmail);
    const encounter = await createEncounter();
    const created = await createPrescription(practitioner, encounter.id, {
      items: [{ position: 0, medicationName: 'List filter' }],
    });
    const list = await practitioner
      .get(`/api/v1/patients/${patientId}/prescriptions`)
      .query({ page: 1, pageSize: 2, status: 'DRAFT', clinicalEncounterId: encounter.id })
      .expect(200);
    expect(list.body.pagination.page).toBe(1);
    expect(list.body.data.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
    expect(
      list.body.data.find((item: { id: string; itemCount: number }) => item.id === created.body.id)
        ?.itemCount,
    ).toBe(1);
    expect(list.body.data.every((item: { status: string }) => item.status === 'DRAFT')).toBe(true);
    expect(
      list.body.data.every(
        (item: { parentEncounterStatus: string }) => item.parentEncounterStatus !== 'VOIDED',
      ),
    ).toBe(true);
  });
});
