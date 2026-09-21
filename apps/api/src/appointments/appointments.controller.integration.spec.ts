import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppointmentStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../app.module';
import { ApiExceptionFilter } from '../http/api-exception.filter';
import { PasswordService } from '../auth/password.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const password = 'Agenda-Test-Password!2026';

// These integration tests prove tenant isolation, lifecycle invariants and database conflict safety.
describeDatabase('agenda backend', () => {
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
  let membershipId: string;
  let foreignMembershipId: string;
  let ownerId: string;
  let foreignOwnerId: string;
  let patientId: string;
  let secondPatientId: string;
  let foreignPatientId: string;
  let userEmail: string;

  async function login(email = userEmail, agent = request.agent(app.getHttpServer())) {
    return agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
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
        data: {
          name: `Agenda North ${suffix}`,
          slug: `agenda-north-${suffix}`,
          timezone: 'America/Bogota',
        },
      }),
      prisma.organization.create({
        data: {
          name: `Agenda South ${suffix}`,
          slug: `agenda-south-${suffix}`,
          timezone: 'America/Bogota',
        },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizationIds.push(organization.id, foreignOrganization.id);
    const [location, foreignLocation] = await Promise.all([
      prisma.clinicLocation.create({ data: { organizationId, name: 'Agenda North Location' } }),
      prisma.clinicLocation.create({
        data: { organizationId: foreignOrganizationId, name: 'Agenda South Location' },
      }),
    ]);
    locationId = location.id;
    foreignLocationId = foreignLocation.id;
    locationIds.push(location.id, foreignLocation.id);
    userEmail = `agenda-user-${suffix}@example.local`;
    const foreignUserEmail = `agenda-foreign-${suffix}@example.local`;
    const [user, foreignUser] = await Promise.all([
      prisma.user.create({ data: { email: userEmail, passwordHash } }),
      prisma.user.create({ data: { email: foreignUserEmail, passwordHash } }),
    ]);
    userIds.push(user.id, foreignUser.id);
    const [membership, foreignMembership] = await Promise.all([
      prisma.membership.create({
        data: { userId: user.id, organizationId, role: 'OWNER', status: 'ACTIVE' },
      }),
      prisma.membership.create({
        data: {
          userId: foreignUser.id,
          organizationId: foreignOrganizationId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      }),
    ]);
    membershipId = membership.id;
    foreignMembershipId = foreignMembership.id;
    membershipIds.push(membership.id, foreignMembership.id);
    const [owner, foreignOwner] = await Promise.all([
      prisma.owner.create({
        data: {
          organizationId,
          firstName: 'Agenda',
          lastName: 'Owner',
          documentType: 'TEST',
          documentNumber: `AGENDA-${suffix}`,
          documentNumberNormalized: `AGENDA-${suffix}`,
        },
      }),
      prisma.owner.create({
        data: {
          organizationId: foreignOrganizationId,
          firstName: 'Foreign',
          lastName: 'Owner',
          documentType: 'TEST',
          documentNumber: `FOREIGN-${suffix}`,
          documentNumberNormalized: `FOREIGN-${suffix}`,
        },
      }),
    ]);
    ownerId = owner.id;
    foreignOwnerId = foreignOwner.id;
    ownerIds.push(owner.id, foreignOwner.id);
    const [patient, secondPatient, foreignPatient] = await Promise.all([
      prisma.patient.create({
        data: {
          organizationId,
          ownerId,
          name: 'Agenda Patient',
          nameNormalized: 'agenda patient',
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId,
          ownerId,
          name: 'Agenda Patient Two',
          nameNormalized: 'agenda patient two',
          species: 'CAT',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwnerId,
          name: 'Foreign Patient',
          nameNormalized: 'foreign patient',
          species: 'DOG',
        },
      }),
    ]);
    patientId = patient.id;
    secondPatientId = secondPatient.id;
    foreignPatientId = foreignPatient.id;
    patientIds.push(patient.id, secondPatient.id, foreignPatient.id);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.availabilityRule.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    await prisma.owner.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.membership.deleteMany({ where: { id: { in: membershipIds } } });
    await prisma.clinicLocation.deleteMany({ where: { id: { in: locationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await app?.close();
    await prisma.$disconnect();
  });

  it('creates and lists a tenant-safe appointment with explicit timezone', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    const created = await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId,
        assignedMembershipId: membershipId,
        startsAt: '2031-01-08T14:00:00-05:00',
        endsAt: '2031-01-08T14:30:00-05:00',
        reason: 'Consulta',
      })
      .expect(201);
    expect(created.body.status).toBe('SCHEDULED');
    expect(created.body.createdByMembershipId).toBe(membershipId);
    const list = await agent
      .get('/api/v1/appointments')
      .query({ from: '2031-01-01T00:00:00Z', to: '2031-01-31T00:00:00Z' })
      .expect(200);
    expect(list.body.data.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
  });

  it('rejects appointment list ranges longer than 90 days', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    await agent
      .get('/api/v1/appointments')
      .query({ from: '2031-01-01T00:00:00Z', to: '2031-04-02T00:00:00Z' })
      .expect(400);
  });

  it('rejects ambiguous times and cross-tenant references', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    const mismatchedOwner = await prisma.owner.create({
      data: {
        organizationId,
        firstName: 'Mismatch',
        lastName: 'Owner',
        documentType: 'TEST',
        documentNumber: `MISMATCH-${suffix}`,
        documentNumberNormalized: `MISMATCH-${suffix}`,
      },
    });
    ownerIds.push(mismatchedOwner.id);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId: mismatchedOwner.id,
        startsAt: '2031-02-01T14:00:00Z',
        endsAt: '2031-02-01T14:30:00Z',
        reason: 'Mismatch',
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('OWNER_PATIENT_MISMATCH'));
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId,
        startsAt: '2031-02-01T14:00:00',
        endsAt: '2031-02-01T14:30:00Z',
        reason: 'Invalid',
      })
      .expect(400);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: foreignLocationId,
        patientId,
        ownerId,
        startsAt: '2031-02-01T14:00:00Z',
        endsAt: '2031-02-01T14:30:00Z',
        reason: 'Foreign',
      })
      .expect(404);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId: foreignPatientId,
        ownerId,
        startsAt: '2031-02-01T14:00:00Z',
        endsAt: '2031-02-01T14:30:00Z',
        reason: 'Foreign',
      })
      .expect(404);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId: foreignOwnerId,
        startsAt: '2031-02-01T14:00:00Z',
        endsAt: '2031-02-01T14:30:00Z',
        reason: 'Foreign',
      })
      .expect(404);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId,
        assignedMembershipId: foreignMembershipId,
        startsAt: '2031-02-01T14:00:00Z',
        endsAt: '2031-02-01T14:30:00Z',
        reason: 'Foreign',
      })
      .expect(404);
  });

  it('validates availability, half-open intervals and independent owner conflicts', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    await agent
      .post('/api/v1/availability-rules')
      .send({
        clinicLocationId: locationId,
        dayOfWeek: 2,
        startLocalTime: '09:00',
        endLocalTime: '10:00',
        slotMinutes: 30,
      })
      .expect(201);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId: secondPatientId,
        ownerId,
        assignedMembershipId: membershipId,
        startsAt: '2031-01-07T13:50:00Z',
        endsAt: '2031-01-07T14:10:00Z',
        reason: 'Fuera',
      })
      .expect(409);
    const first = await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId: secondPatientId,
        ownerId,
        assignedMembershipId: membershipId,
        startsAt: '2031-01-07T14:00:00Z',
        endsAt: '2031-01-07T14:30:00Z',
        reason: 'Primera',
      })
      .expect(201);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId,
        assignedMembershipId: null,
        startsAt: '2031-01-07T14:30:00Z',
        endsAt: '2031-01-07T15:00:00Z',
        reason: 'Back to back',
      })
      .expect(201);
    await agent
      .post(`/api/v1/appointments/${first.body.id}/reschedule`)
      .send({ startsAt: '2031-01-07T14:00:00Z', endsAt: '2031-01-07T14:30:00Z' })
      .expect(201);
  });

  it('enforces lifecycle actions and keeps confirmation independent', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    const created = await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId,
        startsAt: '2031-03-04T14:00:00Z',
        endsAt: '2031-03-04T14:30:00Z',
        reason: 'Estado',
      })
      .expect(201);
    const confirmed = await agent
      .post(`/api/v1/appointments/${created.body.id}/confirm-by-clinic`)
      .expect(201);
    expect(confirmed.body.status).toBe('SCHEDULED');
    expect(confirmed.body.clinicConfirmedAt).not.toBeNull();
    await agent.post(`/api/v1/appointments/${created.body.id}/check-in`).expect(201);
    await agent.post(`/api/v1/appointments/${created.body.id}/start`).expect(201);
    await agent.post(`/api/v1/appointments/${created.body.id}/complete`).expect(201);
    await agent.post(`/api/v1/appointments/${created.body.id}/cancel`).send({}).expect(409);
    await agent.post(`/api/v1/appointments/${created.body.id}/start`).expect(409);
    await agent
      .post(`/api/v1/appointments/${created.body.id}/confirm-by-clinic`)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('INVALID_APPOINTMENT_STATE'));

    const noShow = await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId: secondPatientId,
        ownerId,
        startsAt: '2031-03-05T14:00:00Z',
        endsAt: '2031-03-05T14:30:00Z',
        reason: 'No show',
      })
      .expect(201);
    await agent.post(`/api/v1/appointments/${noShow.body.id}/no-show`).expect(201);
    await agent.post(`/api/v1/appointments/${noShow.body.id}/complete`).expect(409);
  });

  it('separates Patient and Membership conflicts while allowing Owner overlap', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId,
        assignedMembershipId: membershipId,
        startsAt: '2031-08-06T14:00:00Z',
        endsAt: '2031-08-06T14:30:00Z',
        reason: 'Conflict baseline',
      })
      .expect(201);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId,
        assignedMembershipId: null,
        startsAt: '2031-08-06T14:00:00Z',
        endsAt: '2031-08-06T14:30:00Z',
        reason: 'Patient conflict',
      })
      .expect(409);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId: secondPatientId,
        ownerId,
        assignedMembershipId: membershipId,
        startsAt: '2031-08-06T14:00:00Z',
        endsAt: '2031-08-06T14:30:00Z',
        reason: 'Membership conflict',
      })
      .expect(409);
    await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId: secondPatientId,
        ownerId,
        assignedMembershipId: null,
        startsAt: '2031-08-06T14:00:00Z',
        endsAt: '2031-08-06T14:30:00Z',
        reason: 'Owner overlap allowed',
      })
      .expect(201);
  });

  it('cancels only cancellable states and preserves metadata', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    const created = await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId,
        ownerId,
        startsAt: '2031-04-01T14:00:00Z',
        endsAt: '2031-04-01T14:30:00Z',
        reason: 'Cancelar',
      })
      .expect(201);
    const cancelled = await agent
      .post(`/api/v1/appointments/${created.body.id}/cancel`)
      .send({ cancellationReason: 'Cliente solicita' })
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.cancelledByMembershipId).toBe(membershipId);
    await agent
      .post(`/api/v1/appointments/${created.body.id}/reschedule`)
      .send({ startsAt: '2031-04-01T15:00:00Z', endsAt: '2031-04-01T15:30:00Z' })
      .expect(409);
  });

  it('lets exactly one concurrent request win the same patient and membership interval', async () => {
    const firstAgent = request.agent(app.getHttpServer());
    const secondAgent = request.agent(app.getHttpServer());
    await Promise.all([login(userEmail, firstAgent), login(userEmail, secondAgent)]);
    const body = {
      clinicLocationId: locationId,
      patientId,
      ownerId,
      assignedMembershipId: membershipId,
      startsAt: '2031-05-06T14:00:00Z',
      endsAt: '2031-05-06T14:30:00Z',
      reason: 'Concurrent',
    };
    const responses = await Promise.all([
      firstAgent.post('/api/v1/appointments').send(body),
      secondAgent.post('/api/v1/appointments').send(body),
    ]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });

  it('lets exactly one concurrent request win the same patient interval without membership', async () => {
    const firstAgent = request.agent(app.getHttpServer());
    const secondAgent = request.agent(app.getHttpServer());
    await Promise.all([login(userEmail, firstAgent), login(userEmail, secondAgent)]);
    const body = {
      clinicLocationId: locationId,
      patientId: secondPatientId,
      ownerId,
      assignedMembershipId: null,
      startsAt: '2031-05-09T14:00:00Z',
      endsAt: '2031-05-09T14:30:00Z',
      reason: 'Concurrent patient only',
    };
    const responses = await Promise.all([
      firstAgent.post('/api/v1/appointments').send(body),
      secondAgent.post('/api/v1/appointments').send(body),
    ]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });

  it('rejects ambiguous availability overlaps and preserves half-open adjacency', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    const baseline = await agent
      .post('/api/v1/availability-rules')
      .send({
        clinicLocationId: locationId,
        dayOfWeek: 5,
        startLocalTime: '09:00',
        endLocalTime: '10:00',
        slotMinutes: 30,
      })
      .expect(201);
    await agent
      .post('/api/v1/availability-rules')
      .send({
        clinicLocationId: locationId,
        dayOfWeek: 5,
        startLocalTime: '09:30',
        endLocalTime: '10:30',
        slotMinutes: 30,
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('AVAILABILITY_OVERLAP'));
    const adjacent = await agent
      .post('/api/v1/availability-rules')
      .send({
        clinicLocationId: locationId,
        dayOfWeek: 5,
        startLocalTime: '10:00',
        endLocalTime: '11:00',
        slotMinutes: 30,
      })
      .expect(201);
    expect(adjacent.body.id).not.toBe(baseline.body.id);
  });

  it('applies Membership precedence and falls back after deactivation', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    await agent
      .post('/api/v1/availability-rules')
      .send({
        clinicLocationId: locationId,
        dayOfWeek: 4,
        startLocalTime: '09:00',
        endLocalTime: '10:00',
        slotMinutes: 30,
      })
      .expect(201);
    const specific = await agent
      .post('/api/v1/availability-rules')
      .send({
        clinicLocationId: locationId,
        membershipId,
        dayOfWeek: 4,
        startLocalTime: '14:00',
        endLocalTime: '15:00',
        slotMinutes: 30,
      })
      .expect(201);
    const generalSlots = await agent
      .get('/api/v1/agenda/available-slots')
      .query({ date: '2031-06-05', clinicLocationId: locationId, durationMinutes: 30 })
      .expect(200);
    expect(generalSlots.body.slots.map((slot: { startsAt: string }) => slot.startsAt)).toHaveLength(
      2,
    );
    expect(generalSlots.body.slots[0].startsAt).toContain('T14:00');
    const specificSlots = await agent
      .get('/api/v1/agenda/available-slots')
      .query({
        date: '2031-06-05',
        clinicLocationId: locationId,
        assignedMembershipId: membershipId,
        durationMinutes: 30,
      })
      .expect(200);
    expect(specificSlots.body.slots).toHaveLength(2);
    expect(specificSlots.body.slots[0].startsAt).toContain('T19:00');
    await agent.delete(`/api/v1/availability-rules/${specific.body.id}`).expect(200);
    const fallbackSlots = await agent
      .get('/api/v1/agenda/available-slots')
      .query({
        date: '2031-06-05',
        clinicLocationId: locationId,
        assignedMembershipId: membershipId,
        durationMinutes: 30,
      })
      .expect(200);
    expect(fallbackSlots.body.slots[0].startsAt).toContain('T14:00');
  });

  it('allows exactly one concurrent lifecycle action to win', async () => {
    const firstAgent = request.agent(app.getHttpServer());
    const secondAgent = request.agent(app.getHttpServer());
    await Promise.all([login(userEmail, firstAgent), login(userEmail, secondAgent)]);
    const created = await firstAgent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId: secondPatientId,
        ownerId,
        startsAt: '2031-05-12T14:00:00Z',
        endsAt: '2031-05-12T14:30:00Z',
        reason: 'Concurrent lifecycle',
      })
      .expect(201);
    const responses = await Promise.all([
      firstAgent.post(`/api/v1/appointments/${created.body.id}/check-in`),
      secondAgent.post(`/api/v1/appointments/${created.body.id}/check-in`),
    ]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });

  it('returns unrestricted or rule-based slots without fabricating a 24-hour calendar', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    const unrestricted = await agent
      .get('/api/v1/agenda/available-slots')
      .query({ date: '2031-06-01', clinicLocationId: locationId, durationMinutes: 30 })
      .expect(200);
    expect(unrestricted.body.mode).toBe('UNRESTRICTED');
    expect(unrestricted.body.slots).toEqual([]);
    const rule = await agent
      .post('/api/v1/availability-rules')
      .send({
        clinicLocationId: locationId,
        dayOfWeek: 3,
        startLocalTime: '09:00',
        endLocalTime: '10:00',
        slotMinutes: 30,
      })
      .expect(201);
    await agent
      .patch(`/api/v1/availability-rules/${rule.body.id}`)
      .send({ notes: 'Updated' })
      .expect(200);
    const deactivated = await agent
      .delete(`/api/v1/availability-rules/${rule.body.id}`)
      .expect(200);
    expect(deactivated.body.isActive).toBe(false);
    await agent
      .patch(`/api/v1/availability-rules/${rule.body.id}`)
      .send({ isActive: true })
      .expect(200);
    const ruled = await agent
      .get('/api/v1/agenda/available-slots')
      .query({ date: '2031-06-04', clinicLocationId: locationId, durationMinutes: 30 })
      .expect(200);
    expect(ruled.body.mode).toBe('RULES');
    expect(ruled.body.slots).toHaveLength(2);
  });

  it('returns 404 for cross-tenant detail access', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    const foreign = await prisma.appointment.create({
      data: {
        organizationId: foreignOrganizationId,
        clinicLocationId: foreignLocationId,
        patientId: foreignPatientId,
        ownerId: foreignOwnerId,
        createdByMembershipId: foreignMembershipId,
        status: AppointmentStatus.SCHEDULED,
        startsAt: new Date('2031-07-01T14:00:00Z'),
        endsAt: new Date('2031-07-01T14:30:00Z'),
        reason: 'Foreign',
      },
    });
    await agent.get(`/api/v1/appointments/${foreign.id}`).expect(404);
  });

  it('rejects a nonexistent local DST time when generating slots', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    await prisma.organization.update({
      where: { id: organizationId },
      data: { timezone: 'America/New_York' },
    });
    try {
      await agent
        .post('/api/v1/availability-rules')
        .send({
          clinicLocationId: locationId,
          membershipId,
          dayOfWeek: 0,
          startLocalTime: '02:00',
          endLocalTime: '03:00',
          slotMinutes: 30,
        })
        .expect(201);
      await agent
        .get('/api/v1/agenda/available-slots')
        .query({
          date: '2031-03-09',
          clinicLocationId: locationId,
          assignedMembershipId: membershipId,
          durationMinutes: 30,
        })
        .expect(400);
    } finally {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { timezone: 'America/Bogota' },
      });
    }
  });

  it('rejects an ambiguous local DST time when generating slots', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    await prisma.organization.update({
      where: { id: organizationId },
      data: { timezone: 'America/New_York' },
    });
    try {
      // Keep this DST rule isolated from the spring-forward fixture created above.
      await prisma.availabilityRule.updateMany({
        where: { organizationId, clinicLocationId: locationId, membershipId, dayOfWeek: 0 },
        data: { isActive: false },
      });
      await agent
        .post('/api/v1/availability-rules')
        .send({
          clinicLocationId: locationId,
          membershipId,
          dayOfWeek: 0,
          startLocalTime: '01:00',
          endLocalTime: '03:00',
          slotMinutes: 30,
        })
        .expect(201);
      await agent
        .get('/api/v1/agenda/available-slots')
        .query({
          date: '2031-11-02',
          clinicLocationId: locationId,
          assignedMembershipId: membershipId,
          durationMinutes: 30,
        })
        .expect(400);
    } finally {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { timezone: 'America/Bogota' },
      });
    }
  });

  it('enforces the initial role matrix for Agenda actions', async () => {
    const ownerAgent = request.agent(app.getHttpServer());
    await login(userEmail, ownerAgent);
    const createBody = {
      clinicLocationId: locationId,
      patientId,
      ownerId,
      startsAt: '2032-02-05T14:00:00Z',
      endsAt: '2032-02-05T14:30:00Z',
      reason: 'Role matrix',
    };
    const receptionCandidate = await ownerAgent
      .post('/api/v1/appointments')
      .send(createBody)
      .expect(201);
    await prisma.membership.update({ where: { id: membershipId }, data: { role: 'RECEPTION' } });
    const reception = request.agent(app.getHttpServer());
    await login(userEmail, reception);
    await reception
      .post(`/api/v1/appointments/${receptionCandidate.body.id}/cancel`)
      .send({})
      .expect(201);
    await prisma.membership.update({ where: { id: membershipId }, data: { role: 'VETERINARIAN' } });
    const veterinarian = request.agent(app.getHttpServer());
    await login(userEmail, veterinarian);
    const veterinarianCandidate = await veterinarian
      .post('/api/v1/appointments')
      .send({ ...createBody, startsAt: '2032-02-06T14:00:00Z', endsAt: '2032-02-06T14:30:00Z' })
      .expect(201);
    await veterinarian
      .post(`/api/v1/appointments/${veterinarianCandidate.body.id}/check-in`)
      .expect(201);
    await veterinarian
      .post(`/api/v1/appointments/${veterinarianCandidate.body.id}/start`)
      .expect(201);
    await veterinarian
      .post(`/api/v1/appointments/${veterinarianCandidate.body.id}/complete`)
      .expect(201);
    await veterinarian
      .post(`/api/v1/appointments/${veterinarianCandidate.body.id}/cancel`)
      .send({})
      .expect(403);
    const assistantCandidate = await veterinarian
      .post('/api/v1/appointments')
      .send({ ...createBody, startsAt: '2032-02-07T14:00:00Z', endsAt: '2032-02-07T14:30:00Z' })
      .expect(201);
    await prisma.membership.update({ where: { id: membershipId }, data: { role: 'ASSISTANT' } });
    const assistant = request.agent(app.getHttpServer());
    await login(userEmail, assistant);
    await assistant.post(`/api/v1/appointments/${assistantCandidate.body.id}/complete`).expect(403);
    await prisma.membership.update({ where: { id: membershipId }, data: { role: 'GROOMER' } });
    const groomer = request.agent(app.getHttpServer());
    await login(userEmail, groomer);
    await groomer
      .get('/api/v1/appointments')
      .query({ from: '2032-02-05T00:00:00Z', to: '2032-02-10T00:00:00Z' })
      .expect(200);
    await groomer.post('/api/v1/appointments').send(createBody).expect(403);
    await prisma.membership.update({ where: { id: membershipId }, data: { role: 'CASHIER' } });
    const cashier = request.agent(app.getHttpServer());
    await login(userEmail, cashier);
    await cashier
      .get('/api/v1/appointments')
      .query({ from: '2032-02-05T00:00:00Z', to: '2032-02-10T00:00:00Z' })
      .expect(200);
    await cashier.post('/api/v1/appointments').send(createBody).expect(403);
    await prisma.membership.update({ where: { id: membershipId }, data: { role: 'OWNER' } });
  });

  it('prevents archiving a Patient with future blocking appointments', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(userEmail, agent);
    const archivePatient = await prisma.patient.create({
      data: {
        organizationId,
        ownerId,
        name: `Archive Patient ${suffix}`,
        nameNormalized: `archive patient ${suffix}`.toLowerCase(),
        species: 'DOG',
      },
    });
    patientIds.push(archivePatient.id);
    const appointment = await agent
      .post('/api/v1/appointments')
      .send({
        clinicLocationId: locationId,
        patientId: archivePatient.id,
        ownerId,
        startsAt: '2032-01-01T14:00:00Z',
        endsAt: '2032-01-01T14:30:00Z',
        reason: 'Archive guard',
      })
      .expect(201);
    await agent
      .post(`/api/v1/patients/${archivePatient.id}/archive`)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('PATIENT_HAS_FUTURE_APPOINTMENTS'));
    await agent.post(`/api/v1/appointments/${appointment.body.id}/cancel`).send({}).expect(201);
    await agent.post(`/api/v1/patients/${archivePatient.id}/archive`).expect(201);
    const historical = await agent.get(`/api/v1/appointments/${appointment.body.id}`).expect(200);
    expect(historical.body.patient.status).toBe('ARCHIVED');
  });
});
