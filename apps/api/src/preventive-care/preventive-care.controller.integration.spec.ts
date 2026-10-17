import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PasswordService } from '../auth/password.service';
import { ApiExceptionFilter } from '../http/api-exception.filter';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const password = 'Preventive-Test-Password!2026';

// This suite verifies preventive-care aggregates against the real PostgreSQL schema.
describeDatabase('preventive care API', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const organizationIds: string[] = [];
  const locationIds: string[] = [];
  const userIds: string[] = [];
  const membershipIds: string[] = [];
  const ownerIds: string[] = [];
  const patientIds: string[] = [];
  const recordIds: string[] = [];
  const encounterIds: string[] = [];
  const vaccinationIds: string[] = [];
  const dewormingIds: string[] = [];
  let organizationId: string;
  let foreignOrganizationId: string;
  let locationId: string;
  let foreignLocationId: string;
  let patientId: string;
  let foreignPatientId: string;
  let ownerId: string;
  let practitionerEmail: string;
  let assistantEmail: string;
  let otherPractitionerEmail: string;
  let foreignPractitionerEmail: string;
  let practitionerMembershipId: string;
  let assistantMembershipId: string;
  let otherPractitionerMembershipId: string;
  let foreignMembershipId: string;

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
    return agent;
  }

  async function createEncounter(
    options: {
      organization?: string;
      patient?: string;
      status?: 'DRAFT' | 'FINALIZED';
      responsibleMembershipId?: string | null;
    } = {},
  ) {
    const targetOrganizationId = options.organization ?? organizationId;
    const targetPatientId = options.patient ?? patientId;
    const targetPatient = await prisma.patient.findUniqueOrThrow({
      where: { id: targetPatientId },
      select: { ownerId: true },
    });
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
    const status = options.status ?? 'DRAFT';
    const encounter = await prisma.clinicalEncounter.create({
      data: {
        organizationId: targetOrganizationId,
        clinicalRecordId: record.id,
        patientId: targetPatientId,
        ownerIdAtTime: targetPatient.ownerId,
        clinicLocationId: targetLocationId,
        responsibleMembershipId:
          options.responsibleMembershipId ?? (status === 'FINALIZED' ? creatorMembershipId : null),
        status,
        version: status === 'FINALIZED' ? 2 : 1,
        reason: `Preventive integration ${suffix}`,
        professionalDisplayNameSnapshot: status === 'FINALIZED' ? 'Dr. Preventive Original' : null,
        professionalLicenseSnapshot: status === 'FINALIZED' ? 'LIC-PREVENTIVE' : null,
        finalizedAt: status === 'FINALIZED' ? new Date('2032-01-01T10:00:00.000Z') : null,
        finalizedByMembershipId: status === 'FINALIZED' ? creatorMembershipId : null,
        occurredAt: new Date('2032-01-01T09:00:00.000Z'),
        createdByMembershipId: creatorMembershipId,
      },
    });
    encounterIds.push(encounter.id);
    return encounter;
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
        data: { name: `Preventive North ${suffix}`, slug: `preventive-north-${suffix}` },
      }),
      prisma.organization.create({
        data: { name: `Preventive South ${suffix}`, slug: `preventive-south-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizationIds.push(organization.id, foreignOrganization.id);
    const [location, foreignLocation] = await Promise.all([
      prisma.clinicLocation.create({ data: { organizationId, name: 'Preventive North' } }),
      prisma.clinicLocation.create({
        data: { organizationId: foreignOrganizationId, name: 'Preventive South' },
      }),
    ]);
    locationId = location.id;
    foreignLocationId = foreignLocation.id;
    locationIds.push(location.id, foreignLocation.id);

    practitionerEmail = `preventive-practitioner-${suffix}@example.local`;
    assistantEmail = `preventive-assistant-${suffix}@example.local`;
    otherPractitionerEmail = `preventive-other-${suffix}@example.local`;
    foreignPractitionerEmail = `preventive-foreign-${suffix}@example.local`;
    const users = await Promise.all(
      [practitionerEmail, assistantEmail, otherPractitionerEmail, foreignPractitionerEmail].map(
        (email) => prisma.user.create({ data: { email, passwordHash } }),
      ),
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
    foreignMembershipId = memberships[3]!.id;
    await prisma.membershipProfessionalProfile.createMany({
      data: [
        {
          organizationId,
          membershipId: practitionerMembershipId,
          displayName: 'Dr. Preventive Original',
          licenseNumber: 'LIC-PREVENTIVE',
        },
        {
          organizationId,
          membershipId: memberships[1]!.id,
          displayName: 'Clinical Assistant QA',
          licenseNumber: null,
        },
        {
          organizationId,
          membershipId: otherPractitionerMembershipId,
          displayName: 'Dr. Other Preventive',
          licenseNumber: 'LIC-OTHER',
        },
        {
          organizationId: foreignOrganizationId,
          membershipId: foreignMembershipId,
          displayName: 'Dr. Foreign Preventive',
          licenseNumber: 'LIC-FOREIGN',
        },
      ],
    });
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
          name: 'Preventive Patient',
          nameNormalized: 'preventive patient',
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwner.id,
          name: 'Foreign Preventive Patient',
          nameNormalized: 'foreign preventive patient',
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
    await prisma.vaccination.deleteMany({ where: { id: { in: vaccinationIds } } });
    await prisma.deworming.deleteMany({ where: { id: { in: dewormingIds } } });
    await prisma.clinicalAuditEvent.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.clinicalEncounter.deleteMany({ where: { id: { in: encounterIds } } });
    await prisma.clinicalRecord.deleteMany({ where: { id: { in: recordIds } } });
    await prisma.membershipProfessionalProfile.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    await prisma.owner.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.membership.deleteMany({ where: { id: { in: membershipIds } } });
    await prisma.clinicLocation.deleteMany({ where: { id: { in: locationIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app?.close();
    await prisma.$disconnect();
  });

  it('creates, updates and finalizes vaccination with server-owned snapshots', async () => {
    const practitioner = await login(practitionerEmail);
    const encounter = await createEncounter();
    await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/vaccinations`)
      .send({ administeredOn: '2032-02-01', nextDueOn: '2032-01-01' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('INVALID_NEXT_DUE_DATE'));
    const created = await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/vaccinations`)
      .send({
        administeredOn: '2032-02-01',
        nextDueOn: '2032-08-01',
        vaccineName: '  Rabia QA  ',
        responsiblePractitionerMembershipId: practitionerMembershipId,
        patientNameSnapshot: 'Injected snapshot',
      })
      .expect(400);
    expect(created.body.code).toBe('VALIDATION_ERROR');
    const draft = await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/vaccinations`)
      .send({
        administeredOn: '2032-02-01',
        nextDueOn: '2032-08-01',
        vaccineName: '  Rabia QA  ',
        responsiblePractitionerMembershipId: practitionerMembershipId,
      })
      .expect(201);
    vaccinationIds.push(draft.body.id as string);
    expect(draft.body.status).toBe('DRAFT');
    const updated = await practitioner
      .patch(`/api/v1/vaccinations/${draft.body.id}`)
      .send({ expectedVersion: 1, notes: '  Observación QA  ' })
      .expect(200);
    expect(updated.body.version).toBe(2);
    const currentOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Current', lastName: 'Owner' },
    });
    ownerIds.push(currentOwner.id);
    await prisma.patient.update({ where: { id: patientId }, data: { ownerId: currentOwner.id } });
    await practitioner
      .post(`/api/v1/vaccinations/${draft.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect((response) => {
        if (response.status !== 201) console.error('vaccination finalize response', response.body);
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('FINALIZED');
        expect(body.patientNameSnapshot).toBe('Preventive Patient');
        expect(body.ownerDisplayNameSnapshot).toBe('Original Owner');
        expect(body.professionalDisplayNameSnapshot).toBe('Dr. Preventive Original');
        expect(body.vaccineName).toBe('Rabia QA');
      });
    await prisma.patient.update({ where: { id: patientId }, data: { name: 'Patient Renamed' } });
    await prisma.owner.update({ where: { id: ownerId }, data: { firstName: 'Owner Renamed' } });
    const historical = await practitioner.get(`/api/v1/vaccinations/${draft.body.id}`).expect(200);
    expect(historical.body.patientNameSnapshot).toBe('Preventive Patient');
    expect(historical.body.ownerDisplayNameSnapshot).toBe('Original Owner');
    expect(historical.body.patient.name).toBe('Patient Renamed');
    expect(historical.body.parentEncounterStatus).toBe('DRAFT');
    expect(
      await prisma.clinicalAuditEvent.count({
        where: { entityType: 'VACCINATION', entityId: draft.body.id },
      }),
    ).toBe(3);
  });

  it('supports assistant draft operations, deworming lifecycle and date-filtered lists', async () => {
    const assistant = await login(assistantEmail);
    const practitioner = await login(practitionerEmail);
    const encounter = await createEncounter();
    const draft = await assistant
      .post(`/api/v1/clinical-encounters/${encounter.id}/dewormings`)
      .send({ productName: '  Producto QA  ', administeredByMembershipId: assistantMembershipId })
      .expect(201);
    dewormingIds.push(draft.body.id as string);
    await assistant
      .patch(`/api/v1/dewormings/${draft.body.id}`)
      .send({
        expectedVersion: 1,
        administeredOn: '2032-03-01',
        nextDueOn: '2032-06-01',
        productName: 'Producto QA',
      })
      .expect(200);
    await assistant
      .post(`/api/v1/dewormings/${draft.body.id}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(403);
    const prepared = await practitioner
      .patch(`/api/v1/dewormings/${draft.body.id}`)
      .send({ expectedVersion: 2, responsiblePractitionerMembershipId: practitionerMembershipId })
      .expect(200);
    expect(prepared.body.version).toBe(3);
    await practitioner
      .post(`/api/v1/dewormings/${draft.body.id}/finalize`)
      .send({ expectedVersion: 3 })
      .expect((response) => {
        if (response.status !== 201) console.error('deworming finalize response', response.body);
      })
      .expect(201);
    const finalized = await practitioner.get(`/api/v1/dewormings/${draft.body.id}`).expect(200);
    expect(finalized.body.administeredByDisplayNameSnapshot).toBe('Clinical Assistant QA');
    const voided = await practitioner
      .post(`/api/v1/dewormings/${draft.body.id}/void`)
      .send({ expectedVersion: 4, reason: 'Corrección QA' })
      .expect(201);
    expect(voided.body.status).toBe('VOIDED');
    await practitioner
      .get(`/api/v1/patients/${patientId}/dewormings`)
      .query({ from: '2032-03-01', to: '2032-03-02' })
      .expect(200)
      .expect(({ body }) =>
        expect(body.data.some((item: { id: string }) => item.id === draft.body.id)).toBe(true),
      );
  });

  it('enforces tenant isolation, role permissions and compare-and-set races', async () => {
    const practitioner = await login(practitionerEmail);
    const otherPractitioner = await login(otherPractitionerEmail);
    const foreignPractitioner = await login(foreignPractitionerEmail);
    const encounter = await createEncounter();
    const draft = await practitioner
      .post(`/api/v1/clinical-encounters/${encounter.id}/vaccinations`)
      .send({
        administeredOn: '2032-04-01',
        vaccineName: 'Race QA',
        responsiblePractitionerMembershipId: practitionerMembershipId,
      })
      .expect(201);
    vaccinationIds.push(draft.body.id as string);
    const updateResponses = await Promise.all([
      practitioner
        .patch(`/api/v1/vaccinations/${draft.body.id}`)
        .send({ expectedVersion: 1, notes: 'Race A' }),
      practitioner
        .patch(`/api/v1/vaccinations/${draft.body.id}`)
        .send({ expectedVersion: 1, notes: 'Race B' }),
    ]);
    expect(updateResponses.map((response) => response.status).sort()).toEqual([200, 409]);
    const raceFinalizeResponses = await Promise.all([
      practitioner
        .post(`/api/v1/vaccinations/${draft.body.id}/finalize`)
        .send({ expectedVersion: 2 }),
      otherPractitioner
        .post(`/api/v1/vaccinations/${draft.body.id}/finalize`)
        .send({ expectedVersion: 2 }),
    ]);
    console.error(
      'vaccination race finalize responses',
      raceFinalizeResponses.map((response) => ({ status: response.status, body: response.body })),
    );
    expect(raceFinalizeResponses.map((response) => response.status).sort()).toEqual([201, 409]);
    const foreignEncounter = await createEncounter({
      organization: foreignOrganizationId,
      patient: foreignPatientId,
    });
    const foreignDraft = await foreignPractitioner
      .post(`/api/v1/clinical-encounters/${foreignEncounter.id}/dewormings`)
      .send({ productName: 'Foreign QA' })
      .expect(201);
    dewormingIds.push(foreignDraft.body.id as string);
    await practitioner.get(`/api/v1/dewormings/${foreignDraft.body.id}`).expect(404);
    await practitioner.get(`/api/v1/patients/${foreignPatientId}/dewormings`).expect(404);
    await practitioner
      .post(`/api/v1/clinical-encounters/${foreignEncounter.id}/dewormings`)
      .send({})
      .expect(404);
  });

  it('serializes Encounter VOID against preventive create, update and finalize', async () => {
    const practitioner = await login(practitionerEmail);
    const concurrentPractitioner = await login(practitionerEmail);

    const createParent = await createEncounter({
      status: 'FINALIZED',
      responsibleMembershipId: practitionerMembershipId,
    });
    const [createResponse, createVoidResponse] = await Promise.all([
      practitioner
        .post(`/api/v1/clinical-encounters/${createParent.id}/vaccinations`)
        .send({ vaccineName: 'Create race QA' }),
      concurrentPractitioner
        .post(`/api/v1/clinical-encounters/${createParent.id}/void`)
        .send({ expectedVersion: 2, reason: 'Create race parent void' }),
    ]);
    expect(createVoidResponse.status).toBe(201);
    expect([201, 409]).toContain(createResponse.status);
    if (createResponse.status === 201) vaccinationIds.push(createResponse.body.id as string);
    else expect(createResponse.body.code).toBe('PARENT_CLINICAL_ENCOUNTER_VOIDED');

    const updateParent = await createEncounter({
      status: 'FINALIZED',
      responsibleMembershipId: practitionerMembershipId,
    });
    const updateDraft = await practitioner
      .post(`/api/v1/clinical-encounters/${updateParent.id}/dewormings`)
      .send({ productName: 'Update race QA' })
      .expect(201);
    dewormingIds.push(updateDraft.body.id as string);
    const [updateResponse, updateVoidResponse] = await Promise.all([
      practitioner
        .patch(`/api/v1/dewormings/${updateDraft.body.id}`)
        .send({ expectedVersion: 1, notes: 'Update race winner' }),
      concurrentPractitioner
        .post(`/api/v1/clinical-encounters/${updateParent.id}/void`)
        .send({ expectedVersion: 2, reason: 'Update race parent void' }),
    ]);
    expect(updateVoidResponse.status).toBe(201);
    expect([200, 409]).toContain(updateResponse.status);
    if (updateResponse.status === 409)
      expect(updateResponse.body.code).toBe('PARENT_CLINICAL_ENCOUNTER_VOIDED');

    const finalizeParent = await createEncounter({
      status: 'FINALIZED',
      responsibleMembershipId: practitionerMembershipId,
    });
    const finalizeDraft = await practitioner
      .post(`/api/v1/clinical-encounters/${finalizeParent.id}/vaccinations`)
      .send({
        administeredOn: '2032-06-01',
        vaccineName: 'Finalize race QA',
        responsiblePractitionerMembershipId: practitionerMembershipId,
      })
      .expect(201);
    vaccinationIds.push(finalizeDraft.body.id as string);
    const [finalizeResponse, finalizeVoidResponse] = await Promise.all([
      practitioner
        .post(`/api/v1/vaccinations/${finalizeDraft.body.id}/finalize`)
        .send({ expectedVersion: 1 }),
      concurrentPractitioner
        .post(`/api/v1/clinical-encounters/${finalizeParent.id}/void`)
        .send({ expectedVersion: 2, reason: 'Finalize race parent void' }),
    ]);
    expect(finalizeVoidResponse.status).toBe(201);
    expect([201, 409]).toContain(finalizeResponse.status);
    if (finalizeResponse.status === 409)
      expect(finalizeResponse.body.code).toBe('PARENT_CLINICAL_ENCOUNTER_VOIDED');
  });

  it('keeps a finalized preventive record immutable and exposes parent VOIDED status', async () => {
    const practitioner = await login(practitionerEmail);
    const parent = await createEncounter({
      status: 'FINALIZED',
      responsibleMembershipId: practitionerMembershipId,
    });
    const draft = await practitioner
      .post(`/api/v1/clinical-encounters/${parent.id}/dewormings`)
      .send({
        administeredOn: '2032-05-01',
        productName: 'Parent QA',
        responsiblePractitionerMembershipId: practitionerMembershipId,
      })
      .expect(201);
    dewormingIds.push(draft.body.id as string);
    await practitioner
      .post(`/api/v1/dewormings/${draft.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
    await practitioner
      .post(`/api/v1/clinical-encounters/${parent.id}/void`)
      .send({ expectedVersion: 2, reason: 'Parent QA' })
      .expect(201);
    await practitioner
      .patch(`/api/v1/dewormings/${draft.body.id}`)
      .send({ expectedVersion: 2, notes: 'No mutation' })
      .expect(409);
    await practitioner
      .get(`/api/v1/dewormings/${draft.body.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('FINALIZED');
        expect(body.parentEncounterStatus).toBe('VOIDED');
      });
  });
});
