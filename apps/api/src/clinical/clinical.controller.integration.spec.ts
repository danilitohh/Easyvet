import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../app.module';
import { ApiExceptionFilter } from '../http/api-exception.filter';
import { PasswordService } from '../auth/password.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const password = 'Clinical-Test-Password!2026';

// These integration tests exercise the bounded clinical API against PostgreSQL and prove that
// lifecycle writes remain tenant-scoped and optimistic-concurrency safe.
describeDatabase('clinical core API', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const membershipIds: string[] = [];
  const ownerIds: string[] = [];
  const patientIds: string[] = [];
  const locationIds: string[] = [];
  let organizationId: string;
  let foreignOrganizationId: string;
  let locationId: string;
  let foreignLocationId: string;
  let practitionerMembershipId: string;
  let practitionerEmail: string;
  let assistantEmail: string;
  let patientId: string;
  let foreignPatientId: string;
  let ownerId: string;

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
    return agent;
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

    const passwords = app.get(PasswordService);
    const passwordHash = await passwords.hash(password);
    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: { name: `Clinical API North ${suffix}`, slug: `clinical-api-north-${suffix}` },
      }),
      prisma.organization.create({
        data: { name: `Clinical API South ${suffix}`, slug: `clinical-api-south-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizationIds.push(organization.id, foreignOrganization.id);
    const [location, foreignLocation] = await Promise.all([
      prisma.clinicLocation.create({ data: { organizationId, name: 'Clinical North' } }),
      prisma.clinicLocation.create({
        data: { organizationId: foreignOrganizationId, name: 'Clinical South' },
      }),
    ]);
    locationId = location.id;
    foreignLocationId = foreignLocation.id;
    locationIds.push(location.id, foreignLocation.id);
    practitionerEmail = `clinical-practitioner-${suffix}@example.local`;
    assistantEmail = `clinical-assistant-${suffix}@example.local`;
    const foreignEmail = `clinical-foreign-${suffix}@example.local`;
    const [practitioner, assistant, foreign] = await Promise.all([
      prisma.user.create({ data: { email: practitionerEmail, passwordHash } }),
      prisma.user.create({ data: { email: assistantEmail, passwordHash } }),
      prisma.user.create({ data: { email: foreignEmail, passwordHash } }),
    ]);
    userIds.push(practitioner.id, assistant.id, foreign.id);
    const [practitionerMembership, assistantMembership, foreignMembership] = await Promise.all([
      prisma.membership.create({
        data: {
          userId: practitioner.id,
          organizationId,
          role: 'OWNER',
          status: 'ACTIVE',
          clinicalRole: 'PRACTITIONER',
        },
      }),
      prisma.membership.create({
        data: {
          userId: assistant.id,
          organizationId,
          role: 'ASSISTANT',
          status: 'ACTIVE',
          clinicalRole: 'CLINICAL_ASSISTANT',
        },
      }),
      prisma.membership.create({
        data: {
          userId: foreign.id,
          organizationId: foreignOrganizationId,
          role: 'OWNER',
          status: 'ACTIVE',
          clinicalRole: 'PRACTITIONER',
        },
      }),
    ]);
    membershipIds.push(practitionerMembership.id, assistantMembership.id, foreignMembership.id);
    practitionerMembershipId = practitionerMembership.id;
    const [owner, foreignOwner] = await Promise.all([
      prisma.owner.create({
        data: { organizationId, firstName: 'Clinical', lastName: 'Owner' },
      }),
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
          name: 'Clinical Patient',
          nameNormalized: 'clinical patient',
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwner.id,
          name: 'Foreign Patient',
          nameNormalized: 'foreign patient',
          species: 'CAT',
        },
      }),
    ]);
    patientId = patient.id;
    foreignPatientId = foreignPatient.id;
    patientIds.push(patient.id, foreignPatient.id);
    await prisma.membershipProfessionalProfile.create({
      data: {
        organizationId,
        membershipId: practitionerMembership.id,
        displayName: 'Dr. Clinical',
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
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
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    await prisma.owner.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.membership.deleteMany({ where: { id: { in: membershipIds } } });
    await prisma.clinicLocation.deleteMany({ where: { id: { in: locationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app?.close();
    await prisma.$disconnect();
  });

  it('lazily creates a record, creates a draft and rejects tenant leakage', async () => {
    const agent = await login(practitionerEmail);
    const empty = await agent.get(`/api/v1/patients/${patientId}/clinical-record`).expect(200);
    expect(empty.body.clinicalRecord).toBeNull();
    const created = await agent
      .post(`/api/v1/patients/${patientId}/clinical-encounters`)
      .send({
        clinicLocationId: locationId,
        occurredAt: '2032-01-08T15:00:00.000Z',
        reason: 'Initial clinical API test',
        anamnesis: 'Cough',
      })
      .expect(201);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.version).toBe(1);
    expect(created.body.ownerIdAtTime).toBe(ownerId);
    expect(created.body.responsibleMembershipId).toBeNull();
    const record = await agent.get(`/api/v1/patients/${patientId}/clinical-record`).expect(200);
    expect(record.body.clinicalRecord.encounterCount).toBe(1);
    await agent.get(`/api/v1/patients/${foreignPatientId}/clinical-record`).expect(404);
    await agent
      .post(`/api/v1/patients/${patientId}/clinical-encounters`)
      .send({
        clinicLocationId: foreignLocationId,
        occurredAt: '2032-01-08T15:00:00.000Z',
        reason: 'Cross tenant',
      })
      .expect(404);
  });

  it('scopes professional profiles to the active membership and lists practitioners minimally', async () => {
    const agent = await login(practitionerEmail);
    const profile = await agent.get('/api/v1/clinical/me/professional-profile').expect(200);
    expect(profile.body).toEqual({
      membershipId: practitionerMembershipId,
      displayName: 'Dr. Clinical',
      licenseNumber: null,
    });
    const updated = await agent
      .put('/api/v1/clinical/me/professional-profile')
      .send({ displayName: 'Dr. Clinical Updated', licenseNumber: 'LIC-6C2A' })
      .expect(200);
    expect(updated.body.displayName).toBe('Dr. Clinical Updated');
    expect(updated.body.licenseNumber).toBe('LIC-6C2A');
    await agent
      .put('/api/v1/clinical/me/professional-profile')
      .send({ displayName: 'Invalid', organizationId })
      .expect(400);
    const practitioners = await agent.get('/api/v1/clinical/practitioners').expect(200);
    expect(practitioners.body.data).toEqual([
      {
        membershipId: practitionerMembershipId,
        displayName: 'Dr. Clinical Updated',
        licenseNumber: 'LIC-6C2A',
        profileConfigured: true,
      },
    ]);
    const clinicalMembers = await agent.get('/api/v1/clinical/members').expect(200);
    expect(clinicalMembers.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          membershipId: practitionerMembershipId,
          clinicalRole: 'PRACTITIONER',
          profileConfigured: true,
        }),
        expect.objectContaining({
          clinicalRole: 'CLINICAL_ASSISTANT',
          profileConfigured: false,
        }),
      ]),
    );
    expect(clinicalMembers.body.data).toHaveLength(2);
    await agent
      .put('/api/v1/clinical/me/professional-profile')
      .send({ displayName: 'Dr. Clinical', licenseNumber: null })
      .expect(200);
  });

  it('supports draft CAS updates, vitals, finalization and managed weight', async () => {
    const agent = await login(practitionerEmail);
    const created = await agent
      .post(`/api/v1/patients/${patientId}/clinical-encounters`)
      .send({
        clinicLocationId: locationId,
        responsibleMembershipId: practitionerMembershipId,
        occurredAt: '2032-01-09T15:00:00.000Z',
        reason: 'Weight test',
      })
      .expect(201);
    const encounterId = created.body.id as string;
    await agent
      .post(`/api/v1/clinical-encounters/${encounterId}/vitals`)
      .send({ measuredAt: '2032-01-09T15:01:00.000Z', weightKg: 12.5 })
      .expect(201);
    const updated = await agent
      .patch(`/api/v1/clinical-encounters/${encounterId}`)
      .send({
        expectedVersion: 1,
        clinicLocationId: locationId,
        responsibleMembershipId: practitionerMembershipId,
        occurredAt: '2032-01-09T15:00:00.000Z',
        reason: 'Weight test updated',
      })
      .expect(200);
    expect(updated.body.version).toBe(2);
    await agent
      .patch(`/api/v1/clinical-encounters/${encounterId}`)
      .send({
        expectedVersion: 1,
        clinicLocationId: locationId,
        responsibleMembershipId: practitionerMembershipId,
        occurredAt: '2032-01-09T15:00:00.000Z',
        reason: 'Stale update',
      })
      .expect(409);
    const finalized = await agent
      .post(`/api/v1/clinical-encounters/${encounterId}/finalize`)
      .send({ expectedVersion: 2 })
      .expect(201);
    expect(finalized.body.status).toBe('FINALIZED');
    expect(finalized.body.professionalDisplayNameSnapshot).toBe('Dr. Clinical');
    await agent
      .put('/api/v1/clinical/me/professional-profile')
      .send({ displayName: 'Dr. Profile Changed', licenseNumber: 'LIC-CHANGED' })
      .expect(200);
    const historical = await agent.get(`/api/v1/clinical-encounters/${encounterId}`).expect(200);
    expect(historical.body.professionalDisplayNameSnapshot).toBe('Dr. Clinical');
    expect(historical.body.professionalLicenseSnapshot).toBeNull();
    await agent
      .put('/api/v1/clinical/me/professional-profile')
      .send({ displayName: 'Dr. Clinical', licenseNumber: null })
      .expect(200);
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });
    expect(Number(patient.currentWeightKg)).toBe(12.5);
    await agent
      .patch(`/api/v1/patients/${patientId}`)
      .send({ currentWeightKg: 13 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('CURRENT_WEIGHT_MANAGED_BY_CLINICAL_RECORD'));
    await agent
      .patch(`/api/v1/clinical-encounters/${encounterId}`)
      .send({ expectedVersion: 3 })
      .expect(409);
    await agent
      .post(`/api/v1/clinical-encounters/${encounterId}/vitals`)
      .send({ measuredAt: '2032-01-09T15:02:00.000Z', temperatureC: 38.2 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('CLINICAL_ENCOUNTER_IMMUTABLE'));
    await agent
      .patch(`/api/v1/clinical-encounters/${encounterId}`)
      .send({ expectedVersion: 3, status: 'DRAFT' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_ERROR'));
  });

  it('creates one lazy record when two first encounters race concurrently', async () => {
    const owner = await prisma.owner.create({
      data: { organizationId, firstName: 'Concurrent', lastName: 'Owner' },
    });
    ownerIds.push(owner.id);
    const patient = await prisma.patient.create({
      data: {
        organizationId,
        ownerId: owner.id,
        name: 'Concurrent Patient',
        nameNormalized: 'concurrent patient',
        species: 'DOG',
      },
    });
    patientIds.push(patient.id);
    const agent = await login(practitionerEmail);
    const payload = {
      clinicLocationId: locationId,
      occurredAt: '2032-01-13T15:00:00.000Z',
      reason: 'Concurrent first encounter',
    };
    const responses = await Promise.all([
      agent.post(`/api/v1/patients/${patient.id}/clinical-encounters`).send(payload),
      agent.post(`/api/v1/patients/${patient.id}/clinical-encounters`).send(payload),
    ]);
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const records = await prisma.clinicalRecord.findMany({
      where: { organizationId, patientId: patient.id },
    });
    expect(records).toHaveLength(1);
    const encounters = await prisma.clinicalEncounter.findMany({
      where: { organizationId, patientId: patient.id },
    });
    expect(encounters).toHaveLength(2);
    expect(
      await prisma.clinicalAuditEvent.count({
        where: { organizationId, entityType: 'CLINICAL_RECORD', entityId: records[0]!.id },
      }),
    ).toBe(1);
  });

  it('rejects new vitals and evolutions after a patient is archived while keeping history readable', async () => {
    const archivedOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Archived', lastName: 'Patient Owner' },
    });
    const archivedPatient = await prisma.patient.create({
      data: {
        organizationId,
        ownerId: archivedOwner.id,
        name: 'Archived Clinical Patient',
        nameNormalized: 'archived clinical patient',
        species: 'DOG',
      },
    });
    ownerIds.push(archivedOwner.id);
    patientIds.push(archivedPatient.id);
    const agent = await login(practitionerEmail);
    const created = await agent
      .post(`/api/v1/patients/${archivedPatient.id}/clinical-encounters`)
      .send({
        clinicLocationId: locationId,
        occurredAt: '2032-01-14T15:00:00.000Z',
        reason: 'Archive activity guard',
      })
      .expect(201);
    await prisma.patient.update({
      where: { id: archivedPatient.id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await agent
      .post(`/api/v1/clinical-encounters/${created.body.id}/vitals`)
      .send({ measuredAt: '2032-01-14T15:01:00.000Z', weightKg: 8 })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await agent
      .post(`/api/v1/patients/${archivedPatient.id}/clinical-evolutions`)
      .send({ occurredAt: '2032-01-14T15:02:00.000Z', assessment: 'Should be rejected' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await agent.get(`/api/v1/clinical-encounters/${created.body.id}`).expect(200);
  });

  it('allows assistants to work on drafts but not finalize, and appends evolutions', async () => {
    const assistant = await login(assistantEmail);
    const created = await assistant
      .post(`/api/v1/patients/${patientId}/clinical-encounters`)
      .send({
        clinicLocationId: locationId,
        occurredAt: '2032-01-10T15:00:00.000Z',
        reason: 'Assistant draft',
      })
      .expect(201);
    await assistant
      .post(`/api/v1/clinical-encounters/${created.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(403);
    const practitioner = await login(practitionerEmail);
    await practitioner
      .post(`/api/v1/clinical-encounters/${created.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409);
    const finalized = await practitioner
      .post(`/api/v1/patients/${patientId}/clinical-encounters`)
      .send({
        clinicLocationId: locationId,
        responsibleMembershipId: practitionerMembershipId,
        occurredAt: '2032-01-11T15:00:00.000Z',
        reason: 'Evolution source',
      })
      .expect(201);
    const otherPractitionerEmail = `clinical-other-practitioner-${suffix}@example.local`;
    const otherPractitioner = await prisma.user.create({
      data: {
        email: otherPractitionerEmail,
        passwordHash: await app.get(PasswordService).hash(password),
      },
    });
    const otherPractitionerMembership = await prisma.membership.create({
      data: {
        userId: otherPractitioner.id,
        organizationId,
        role: 'VETERINARIAN',
        status: 'ACTIVE',
        clinicalRole: 'PRACTITIONER',
      },
    });
    userIds.push(otherPractitioner.id);
    membershipIds.push(otherPractitionerMembership.id);
    const otherPractitionerAgent = await login(otherPractitionerEmail);
    await otherPractitionerAgent
      .post(`/api/v1/clinical-encounters/${finalized.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ONLY_RESPONSIBLE_PRACTITIONER_CAN_FINALIZE'));
    await practitioner
      .post(`/api/v1/clinical-encounters/${finalized.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
    await practitioner
      .post(`/api/v1/patients/${patientId}/clinical-evolutions`)
      .send({
        clinicalEncounterId: finalized.body.id,
        occurredAt: '2032-01-11T16:00:00.000Z',
        subjective: '  ',
        objective: null,
        assessment: null,
        plan: null,
      })
      .expect(400);
    await practitioner
      .post(`/api/v1/patients/${patientId}/clinical-evolutions`)
      .send({
        clinicalEncounterId: finalized.body.id,
        occurredAt: '2032-01-11T16:00:00.000Z',
        assessment: 'Stable',
      })
      .expect(201);
    const evolutions = await practitioner
      .get(`/api/v1/patients/${patientId}/clinical-evolutions`)
      .expect(200);
    expect(evolutions.body.data).toHaveLength(1);
  });

  it('voids finalized encounters and recalculates the clinical weight projection', async () => {
    const agent = await login(practitionerEmail);
    const created = await agent
      .post(`/api/v1/patients/${patientId}/clinical-encounters`)
      .send({
        clinicLocationId: locationId,
        responsibleMembershipId: practitionerMembershipId,
        occurredAt: '2032-01-12T15:00:00.000Z',
        reason: 'Void weight',
      })
      .expect(201);
    await agent
      .post(`/api/v1/clinical-encounters/${created.body.id}/vitals`)
      .send({ measuredAt: '2032-01-12T15:01:00.000Z', weightKg: 14 })
      .expect(201);
    await agent
      .post(`/api/v1/clinical-encounters/${created.body.id}/finalize`)
      .send({ expectedVersion: 1 })
      .expect(201);
    await agent
      .post(`/api/v1/clinical-encounters/${created.body.id}/void`)
      .send({ expectedVersion: 2, reason: 'QA void' })
      .expect(201);
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });
    expect(Number(patient.currentWeightKg)).toBe(12.5);
    const audits = await prisma.clinicalAuditEvent.findMany({
      where: { organizationId, entityId: created.body.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((item) => item.action)).toEqual(['CREATED', 'FINALIZED', 'VOIDED']);
    await agent
      .post(`/api/v1/clinical-encounters/${created.body.id}/void`)
      .send({ expectedVersion: 3, reason: 'Duplicate void' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('INVALID_CLINICAL_ENCOUNTER_STATE'));
    await agent
      .post(`/api/v1/patients/${patientId}/clinical-evolutions`)
      .send({
        clinicalEncounterId: created.body.id,
        occurredAt: '2032-01-12T15:02:00.000Z',
        assessment: 'Should be rejected after void',
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('INVALID_CLINICAL_ENCOUNTER_STATE'));
  });
});
