import { randomBytes } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembershipRole, PlatformRole, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../app.module';
import { ApiExceptionFilter } from '../http/api-exception.filter';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { MembershipsService } from '../memberships/memberships.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const password = 'Strong-Test-Password!2026';

// These integration tests exercise the full cookie/session boundary against the isolated test database.
describeDatabase('real authentication and sessions', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let passwordService: PasswordService;
  let sessions: SessionsService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdUserIds: string[] = [];
  const createdOrganizationIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdMembershipIds: string[] = [];
  const createdLocationIds: string[] = [];
  let singleUser: { id: string; email: string };
  let multiUser: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let suspendedUser: { id: string; email: string };
  let foreignUser: { id: string; email: string };
  let singleMembershipId: string;
  let multiMembershipIds: string[];
  let foreignMembershipId: string;
  let suspendedOrganizationMembershipId: string;
  let multiNorthMembershipId: string;
  let multiSouthMembershipId: string;
  let locationNorthId: string;
  let locationSouthId: string;
  let limitedUser: { id: string; email: string };
  let platformMemberUser: { id: string; email: string };
  let platformMemberMembershipId: string;
  let organizationNorthId: string;
  let organizationSouthId: string;
  let ownerNorthId: string;
  let ownerSouthId: string;
  let patientNorthId: string;
  let patientSouthId: string;

  async function login(email: string, agent = request.agent(app.getHttpServer())) {
    return agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
  }

  function cookieFrom(response: request.Response): string {
    const header = response.headers['set-cookie']?.[0];
    if (!header) throw new Error('Expected session cookie');
    const cookie = header.split(';', 1)[0];
    if (!cookie) throw new Error('Expected session cookie value');
    return cookie;
  }

  function tokenFrom(response: request.Response): string {
    const token = cookieFrom(response).split('=', 2)[1];
    if (!token) throw new Error('Expected session token');
    return token;
  }

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    if (new URL(databaseUrl).pathname.replace(/^\//, '') !== 'easyvet_test') {
      throw new Error('Authentication integration tests must use easyvet_test');
    }
    process.env.DATABASE_URL = databaseUrl;

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
    passwordService = app.get(PasswordService);
    sessions = app.get(SessionsService);

    const passwordHash = await passwordService.hash(password);
    const [organizationOne, organizationTwo, organizationForeign, organizationSuspended] =
      await Promise.all([
        prisma.organization.create({
          data: { name: `Auth North ${suffix}`, slug: `auth-north-${suffix}` },
        }),
        prisma.organization.create({
          data: { name: `Auth South ${suffix}`, slug: `auth-south-${suffix}` },
        }),
        prisma.organization.create({
          data: { name: `Auth Foreign ${suffix}`, slug: `auth-foreign-${suffix}` },
        }),
        prisma.organization.create({
          data: {
            name: `Auth Suspended ${suffix}`,
            slug: `auth-suspended-${suffix}`,
            status: 'SUSPENDED',
          },
        }),
      ]);
    createdOrganizationIds.push(
      organizationOne.id,
      organizationTwo.id,
      organizationForeign.id,
      organizationSuspended.id,
    );
    organizationNorthId = organizationOne.id;
    organizationSouthId = organizationTwo.id;
    const [locationNorth, locationSouth] = await Promise.all([
      prisma.clinicLocation.create({
        data: {
          organizationId: organizationOne.id,
          name: `North Location ${suffix}`,
          city: 'Bogotá',
        },
      }),
      prisma.clinicLocation.create({
        data: {
          organizationId: organizationTwo.id,
          name: `South Location ${suffix}`,
          city: 'Bogotá',
        },
      }),
    ]);
    locationNorthId = locationNorth.id;
    locationSouthId = locationSouth.id;
    await prisma.organizationCommercialSettings.create({
      data: { organizationId: organizationOne.id, currencyCode: 'COP', invoicePrefix: 'AUTH' },
    });

    const [single, multi, admin, suspended, foreign, limited, platformMember] = await Promise.all([
      prisma.user.create({ data: { email: `auth-single-${suffix}@example.local`, passwordHash } }),
      prisma.user.create({ data: { email: `auth-multi-${suffix}@example.local`, passwordHash } }),
      prisma.user.create({
        data: {
          email: `auth-admin-${suffix}@example.local`,
          passwordHash,
          platformRole: PlatformRole.PLATFORM_ADMIN,
        },
      }),
      prisma.user.create({
        data: {
          email: `auth-suspended-${suffix}@example.local`,
          passwordHash,
          status: 'SUSPENDED',
        },
      }),
      prisma.user.create({ data: { email: `auth-foreign-${suffix}@example.local`, passwordHash } }),
      prisma.user.create({ data: { email: `auth-limited-${suffix}@example.local`, passwordHash } }),
      prisma.user.create({
        data: {
          email: `auth-platform-member-${suffix}@example.local`,
          passwordHash,
          platformRole: PlatformRole.PLATFORM_ADMIN,
        },
      }),
    ]);
    createdUserIds.push(
      single.id,
      multi.id,
      admin.id,
      suspended.id,
      foreign.id,
      limited.id,
      platformMember.id,
    );
    singleUser = single;
    multiUser = multi;
    adminUser = admin;
    suspendedUser = suspended;
    foreignUser = foreign;
    limitedUser = limited;
    platformMemberUser = platformMember;

    const memberships = await prisma.membership.createManyAndReturn({
      data: [
        { userId: single.id, organizationId: organizationOne.id, role: 'OWNER', status: 'ACTIVE' },
        { userId: multi.id, organizationId: organizationOne.id, role: 'ADMIN', status: 'ACTIVE' },
        {
          userId: multi.id,
          organizationId: organizationTwo.id,
          role: 'VETERINARIAN',
          status: 'ACTIVE',
        },
        {
          userId: foreign.id,
          organizationId: organizationForeign.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        {
          userId: multi.id,
          organizationId: organizationSuspended.id,
          role: 'ASSISTANT',
          status: 'ACTIVE',
        },
        {
          userId: limited.id,
          organizationId: organizationOne.id,
          role: 'RECEPTION',
          status: 'ACTIVE',
        },
        {
          userId: platformMember.id,
          organizationId: organizationOne.id,
          role: 'VETERINARIAN',
          status: 'ACTIVE',
        },
      ],
    });
    singleMembershipId = memberships.find((membership) => membership.userId === single.id)!.id;
    multiMembershipIds = memberships
      .filter(
        (membership) =>
          membership.userId === multi.id && membership.organizationId !== organizationSuspended.id,
      )
      .map((membership) => membership.id);
    multiNorthMembershipId = memberships.find(
      (membership) =>
        membership.userId === multi.id && membership.organizationId === organizationOne.id,
    )!.id;
    multiSouthMembershipId = memberships.find(
      (membership) =>
        membership.userId === multi.id && membership.organizationId === organizationTwo.id,
    )!.id;
    foreignMembershipId = memberships.find((membership) => membership.userId === foreign.id)!.id;
    suspendedOrganizationMembershipId = memberships.find(
      (membership) => membership.organizationId === organizationSuspended.id,
    )!.id;
    platformMemberMembershipId = memberships.find(
      (membership) => membership.userId === platformMember.id,
    )!.id;

    const [ownerNorth, ownerSouth] = await Promise.all([
      prisma.owner.create({
        data: {
          organizationId: organizationOne.id,
          firstName: 'North',
          lastName: `Owner ${suffix}`,
          documentType: 'TEST_ID',
          documentNumber: `NORTH-${suffix}`,
          documentNumberNormalized: `NORTH-${suffix}`.toUpperCase(),
          email: `owner-north-${suffix}@example.local`,
        },
      }),
      prisma.owner.create({
        data: {
          organizationId: organizationTwo.id,
          firstName: 'South',
          lastName: `Owner ${suffix}`,
          documentType: 'TEST_ID',
          documentNumber: `SOUTH-${suffix}`,
          documentNumberNormalized: `SOUTH-${suffix}`.toUpperCase(),
          email: `owner-south-${suffix}@example.local`,
        },
      }),
    ]);
    ownerNorthId = ownerNorth.id;
    ownerSouthId = ownerSouth.id;
    const [patientNorth, patientSouth] = await Promise.all([
      prisma.patient.create({
        data: {
          organizationId: organizationOne.id,
          ownerId: ownerNorth.id,
          name: `North Patient ${suffix}`,
          nameNormalized: `north patient ${suffix}`,
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: organizationTwo.id,
          ownerId: ownerSouth.id,
          name: `South Patient ${suffix}`,
          nameNormalized: `south patient ${suffix}`,
          species: 'CAT',
        },
      }),
    ]);
    patientNorthId = patientNorth.id;
    patientSouthId = patientSouth.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
    // Append-only audit rows retain actor FKs, so cleanup removes only this suite's rows inside a rollback-safe test transaction.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`ALTER TABLE "organization_audit_events" DISABLE TRIGGER "organization_audit_events_append_only"`;
      await tx.organizationAuditEvent.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
      await tx.$executeRaw`ALTER TABLE "organization_audit_events" ENABLE TRIGGER "organization_audit_events_append_only"`;
    });
    await prisma.membership.deleteMany({ where: { id: { in: createdMembershipIds } } });
    await prisma.clinicLocation.deleteMany({ where: { id: { in: createdLocationIds } } });
    await prisma.patient.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
    await prisma.owner.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.clinicLocation.deleteMany({
      where: { organizationId: { in: createdOrganizationIds } },
    });
    await prisma.organizationCommercialSettings.deleteMany({
      where: { organizationId: { in: createdOrganizationIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
    await app?.close();
    await prisma.$disconnect();
  });

  it('logs in with a normalized email and returns a safe identity', async () => {
    const response = await login(singleUser.email.toUpperCase());
    expect(response.body.user).toEqual({
      id: singleUser.id,
      email: singleUser.email,
      platformRole: 'USER',
      mustChangePassword: false,
    });
    expect(response.body.activeMembership.id).toBe(singleMembershipId);
    expect(response.body.activeMembership.permissions).toEqual(
      expect.arrayContaining([
        'members.read',
        'members.create',
        'members.update',
        'members.suspend',
        'organizationSettings.read',
        'organizationSettings.update',
        'reports.operational.read',
        'reports.clinical.read',
        'reports.commercial.read',
        'reports.inventory.read',
      ]),
    );
    expect(response.body.memberships).toHaveLength(1);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('token');
  });

  it('sets an HttpOnly Lax cookie with the configured path', async () => {
    const response = await login(singleUser.email);
    const header = response.headers['set-cookie']?.[0];
    expect(header).toBeDefined();
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Path=\//i);
    expect(header).toMatch(/SameSite=Lax/i);
  });

  it('stores only a SHA-256 token hash in the database', async () => {
    const response = await login(singleUser.email);
    const cookie = tokenFrom(response);
    const session = await prisma.session.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(session?.tokenHash).toBe(sessions.hashToken(cookie));
    expect(session?.tokenHash).not.toBe(cookie);
    expect(cookie.length).toBeGreaterThanOrEqual(40);
  });

  it('rejects an incorrect password with a generic error', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: singleUser.email, password: 'wrong' })
      .expect(401)
      .expect(({ body }) => expect(body.message).toBe('Invalid credentials'));
  });

  it('rejects an unknown email with the same generic error', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `missing-${suffix}@example.local`, password })
      .expect(401)
      .expect(({ body }) => expect(body.message).toBe('Invalid credentials'));
  });

  it('rejects suspended users before issuing a session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: suspendedUser.email, password })
      .expect(401);
    expect(await prisma.session.count({ where: { userId: suspendedUser.id } })).toBe(0);
  });

  it('allows a platform administrator to login without tenant memberships', async () => {
    const response = await login(adminUser.email);
    expect(response.body.user.platformRole).toBe('PLATFORM_ADMIN');
    expect(response.body.memberships).toEqual([]);
    expect(response.body.activeMembership).toBeNull();
    expect(response.body.organizationSelectionRequired).toBe(false);
  });

  it('requires organization selection when multiple active memberships exist', async () => {
    const response = await login(multiUser.email);
    expect(response.body.activeMembership).toBeNull();
    expect(response.body.memberships).toHaveLength(2);
    expect(response.body.organizationSelectionRequired).toBe(true);
  });

  it('restores the authenticated context through /me', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const response = await agent.get('/api/v1/auth/me').expect(200);
    expect(response.body.activeMembership.id).toBe(singleMembershipId);
  });

  it('rejects /me when no session cookie is present', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('keeps health public while requiring a session for tenant APIs', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' });
    await request(app.getHttpServer())
      .get('/api/v1/organization/current')
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe('AUTHENTICATION_REQUIRED'));
  });

  it('requires an active organization after authentication', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(multiUser.email, agent);
    await agent
      .get('/api/v1/organization/current')
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('ACTIVE_ORGANIZATION_REQUIRED'));
  });

  it('reads the current organization from the selected membership', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const response = await agent.get('/api/v1/organization/current').expect(200);
    expect(response.body).toMatchObject({ id: organizationNorthId, slug: `auth-north-${suffix}` });
  });

  it('allows an owner to update safe organization fields and rejects organizationId', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const updated = await agent
      .patch('/api/v1/organization/current')
      .send({ name: `Updated North ${suffix}`, timezone: 'America/Bogota' })
      .expect(200);
    expect(updated.body.name).toBe(`Updated North ${suffix}`);
    await agent
      .patch('/api/v1/organization/current')
      .send({ organizationId: organizationSouthId, name: 'Should reject' })
      .expect(400);
    await prisma.organization.update({
      where: { id: organizationNorthId },
      data: { name: `Auth North ${suffix}`, timezone: 'UTC' },
    });
  });

  it('isolates locations by tenant and ignores organizationId query injection', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const list = await agent
      .get(`/api/v1/organization/locations?organizationId=${organizationSouthId}`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(locationNorthId);
    expect(list.body.pagination).toMatchObject({ page: 1, pageSize: 100, total: 1, totalPages: 1 });
    await agent.get(`/api/v1/organization/locations/${locationSouthId}`).expect(404);
  });

  it('lists only memberships from the active organization without sensitive fields', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const response = await agent
      .get('/api/v1/organization/memberships?page=1&pageSize=20')
      .expect(200);
    expect(response.body.total).toBe(4);
    expect(response.body.data).toHaveLength(4);
    expect(
      response.body.data.some(
        (membership: { id: string }) => membership.id === foreignMembershipId,
      ),
    ).toBe(false);
    expect(
      response.body.data.some(
        (membership: { user: { email: string } }) => membership.user.email === singleUser.email,
      ),
    ).toBe(true);
    expect(response.body.data[0]).not.toHaveProperty('passwordHash');
    expect(response.body.data[0]).not.toHaveProperty('tokenHash');

    const firstPage = await agent
      .get('/api/v1/organization/memberships?page=1&pageSize=2')
      .expect(200);
    const secondPage = await agent
      .get('/api/v1/organization/memberships?page=2&pageSize=2')
      .expect(200);
    expect(firstPage.body).toMatchObject({ page: 1, pageSize: 2, total: 4 });
    expect(secondPage.body).toMatchObject({ page: 2, pageSize: 2, total: 4 });
    expect(firstPage.body.data).toHaveLength(2);
    expect(secondPage.body.data).toHaveLength(2);
    expect(firstPage.body.data.map((member: { id: string }) => member.id)).not.toEqual(
      secondPage.body.data.map((member: { id: string }) => member.id),
    );
  });

  it('denies membership listing to a reception role', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(limitedUser.email, agent);
    await agent
      .get('/api/v1/organization/memberships')
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('INSUFFICIENT_PERMISSION'));
  });

  it('allows ADMIN organization updates and denies VETERINARIAN updates', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(multiUser.email, agent);
    await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiNorthMembershipId })
      .expect(200);
    await agent
      .patch('/api/v1/organization/current')
      .send({ timezone: 'America/Bogota' })
      .expect(200);
    await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiSouthMembershipId })
      .expect(200);
    await agent
      .patch('/api/v1/organization/current')
      .send({ timezone: 'America/Bogota' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('INSUFFICIENT_PERMISSION'));
    await prisma.organization.update({
      where: { id: organizationNorthId },
      data: { timezone: 'UTC' },
    });
  });

  it('exposes only technical context to platform administrators', async () => {
    const admin = request.agent(app.getHttpServer());
    await login(adminUser.email, admin);
    const platformContext = await admin.get('/api/v1/platform/context').expect(200);
    expect(platformContext.body).toEqual({ userId: adminUser.id, platformRole: 'PLATFORM_ADMIN' });
    await admin.get('/api/v1/organization/current').expect(403);

    const normalUser = request.agent(app.getHttpServer());
    await login(singleUser.email, normalUser);
    await normalUser.get('/api/v1/platform/context').expect(403);
  });

  it('does not give a platform role a tenant bypass, even with a membership', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginResponse = await login(platformMemberUser.email, agent);
    expect(loginResponse.body.activeMembership.permissions).toEqual(
      expect.arrayContaining(['reports.operational.read']),
    );
    expect(loginResponse.body.activeMembership.permissions).not.toContain('members.read');
    expect(loginResponse.body.activeMembership.permissions).not.toContain(
      'reports.commercial.read',
    );
    await agent.get('/api/v1/organization/current').expect(200);
    await agent.patch('/api/v1/organization/current').send({ name: 'Forbidden' }).expect(403);
  });

  it('recalculates effective permissions after switching organizations', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(multiUser.email, agent);
    const north = await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiNorthMembershipId })
      .expect(200);
    expect(north.body.activeMembership.permissions).toContain('memberships.read');
    const south = await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiSouthMembershipId })
      .expect(200);
    expect(south.body.activeMembership.permissions).toEqual(
      expect.arrayContaining(['reports.operational.read']),
    );
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.activeMembership.organization.id).toBe(organizationSouthId);
    expect(me.body.activeMembership.permissions).not.toContain('memberships.read');
  });

  it('lists and reads owners and patients only inside the active tenant', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const owners = await agent.get('/api/v1/owners').expect(200);
    expect(owners.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 1 });
    expect(owners.body.data[0].id).toBe(ownerNorthId);
    const patients = await agent.get('/api/v1/patients').expect(200);
    expect(patients.body.pagination.total).toBe(1);
    expect(patients.body.data[0].id).toBe(patientNorthId);
    await agent.get(`/api/v1/owners/${ownerSouthId}`).expect(404);
    await agent.get(`/api/v1/patients/${patientSouthId}`).expect(404);
    const ownerDetail = await agent.get(`/api/v1/owners/${ownerNorthId}`).expect(200);
    expect(ownerDetail.body.patients[0].id).toBe(patientNorthId);
  });

  it('supports tenant-safe search and pagination without arbitrary tenant input', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const ownerSearch = await agent
      .get('/api/v1/owners')
      .query({ search: 'North', pageSize: 1 })
      .expect(200);
    expect(ownerSearch.body.data).toHaveLength(1);
    expect(ownerSearch.body.data[0].id).toBe(ownerNorthId);
    const patientSearch = await agent
      .get('/api/v1/patients')
      .query({ search: 'North' })
      .expect(200);
    expect(patientSearch.body.data.map((patient: { id: string }) => patient.id)).toEqual([
      patientNorthId,
    ]);
    await agent.get(`/api/v1/owners?organizationId=${organizationSouthId}`).expect(400);
  });

  it('creates, rejects duplicate documents, updates and archives an owner', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const documentNumber = `CREATED-${suffix}`;
    const created = await agent
      .post('/api/v1/owners')
      .send({
        firstName: 'Created',
        lastName: 'Owner',
        documentType: 'TEST_ID',
        documentNumber,
        email: `created-${suffix}@example.local`,
      })
      .expect(201);
    expect(created.body.status).toBe('ACTIVE');
    await agent
      .post('/api/v1/owners')
      .send({ firstName: 'Duplicate', documentType: 'TEST_ID', documentNumber })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_CONFLICT'));
    const updated = await agent
      .patch(`/api/v1/owners/${created.body.id}`)
      .send({ phone: '+57 300 555 0101' })
      .expect(200);
    expect(updated.body.phone).toBe('+57 300 555 0101');
    const archived = await agent.post(`/api/v1/owners/${created.body.id}/archive`).expect(201);
    expect(archived.body.status).toBe('ARCHIVED');
    const activeList = await agent.get('/api/v1/owners').expect(200);
    expect(activeList.body.data.some((owner: { id: string }) => owner.id === created.body.id)).toBe(
      false,
    );
    const archivedList = await agent
      .get('/api/v1/owners')
      .query({ status: 'ARCHIVED', search: 'Created' })
      .expect(200);
    expect(archivedList.body.data[0].id).toBe(created.body.id);
    await agent
      .patch(`/api/v1/owners/${created.body.id}`)
      .send({ city: 'No edits after archive' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_ARCHIVED'));
  });

  it('does not create artificial conflicts for owners without documents', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const [first, second] = await Promise.all([
      agent.post('/api/v1/owners').send({ firstName: `No Document One ${suffix}` }),
      agent.post('/api/v1/owners').send({ firstName: `No Document Two ${suffix}` }),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.documentNumber).toBeNull();
    expect(second.body.documentNumber).toBeNull();
  });

  it('blocks owner archive while active patients remain linked', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    await agent
      .post(`/api/v1/owners/${ownerNorthId}/archive`)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('OWNER_HAS_ACTIVE_PATIENTS'));
    const owner = await agent.get(`/api/v1/owners/${ownerNorthId}`).expect(200);
    expect(owner.body.status).toBe('ACTIVE');
    expect(owner.body.archivedAt).toBeNull();
  });

  it('allows descriptive duplicate patient names and validates weight boundaries', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    const name = `Edge Patient ${suffix}`;
    await agent
      .post('/api/v1/patients')
      .send({ ownerId: ownerNorthId, name, species: 'EXOTIC', birthDate: '2999-01-01' })
      .expect(400);
    await agent
      .post('/api/v1/patients')
      .send({ ownerId: ownerNorthId, name, species: 'EXOTIC', currentWeightKg: 0 })
      .expect(400);
    await agent
      .post('/api/v1/patients')
      .send({ ownerId: ownerNorthId, name, species: 'EXOTIC', currentWeightKg: 1001 })
      .expect(201);
    await agent
      .post('/api/v1/patients')
      .send({ ownerId: ownerNorthId, name, species: 'EXOTIC', currentWeightKg: -1 })
      .expect(400);
    const created = await agent
      .post('/api/v1/patients')
      .send({
        ownerId: ownerNorthId,
        name,
        species: 'EXOTIC',
        microchipNumber: ' chip-01 ',
        birthDate: '2024-02-29',
        currentWeightKg: 1001.25,
      })
      .expect(201);
    expect(created.body.microchipNumber).toBe('CHIP-01');
    expect(created.body.currentWeightKg).toBe(1001.25);
    const duplicate = await agent
      .post('/api/v1/patients')
      .send({
        ownerId: ownerNorthId,
        name: `  ${name.toLowerCase()}  `,
        species: 'EXOTIC',
        currentWeightKg: null,
      })
      .expect(201);
    expect(duplicate.body.name).toBe(name.toLowerCase());
    expect(duplicate.body.currentWeightKg).toBeNull();
    const southAgent = request.agent(app.getHttpServer());
    await login(multiUser.email, southAgent);
    await southAgent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiSouthMembershipId })
      .expect(200);
    const otherOrganization = await southAgent
      .post('/api/v1/patients')
      .send({ ownerId: ownerSouthId, name, species: 'EXOTIC', currentWeightKg: 1500.5 })
      .expect(201);
    expect(otherOrganization.body.name).toBe(name);
    await agent
      .patch(`/api/v1/patients/${created.body.id}`)
      .send({ currentWeightKg: 2000.75 })
      .expect(200)
      .expect(({ body }) => expect(body.currentWeightKg).toBe(2000.75));
    const search = await agent.get('/api/v1/patients').query({ search: 'chip-01' }).expect(200);
    expect(search.body.data.some((patient: { id: string }) => patient.id === created.body.id)).toBe(
      true,
    );
  });

  it('returns validation errors for null required updates and injected lifecycle fields', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    await agent.patch(`/api/v1/owners/${ownerNorthId}`).send({ firstName: null }).expect(400);
    await agent.patch(`/api/v1/patients/${patientNorthId}`).send({ name: null }).expect(400);
    await agent
      .post('/api/v1/owners')
      .send({ firstName: `Injected ${suffix}`, organizationId: organizationSouthId })
      .expect(400);
    await agent
      .patch(`/api/v1/patients/${patientNorthId}`)
      .send({ status: 'ARCHIVED' })
      .expect(400);
  });

  it('keeps cross-tenant writes at 404 and enforces the composite database relation', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    await agent.patch(`/api/v1/owners/${ownerSouthId}`).send({ city: 'Bogotá' }).expect(404);
    await agent.post(`/api/v1/patients/${patientSouthId}/archive`).expect(404);
    await expect(
      prisma.patient.create({
        data: {
          organizationId: organizationNorthId,
          ownerId: ownerSouthId,
          name: `Foreign relation ${suffix}`,
          nameNormalized: `foreign relation ${suffix}`.toLowerCase(),
          species: 'DOG',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects oversized pagination/search and invalid sorting values', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    await agent.get('/api/v1/owners').query({ page: 10001 }).expect(400);
    await agent
      .get('/api/v1/patients')
      .query({ search: 'x'.repeat(121) })
      .expect(400);
    await agent.get('/api/v1/owners').query({ sortBy: 'organizationId' }).expect(400);
  });

  it('denies direct Owner/Patient mutations to a read-only role', async () => {
    await prisma.membership.update({
      where: { id: platformMemberMembershipId },
      data: { role: 'GROOMER' },
    });
    try {
      const agent = request.agent(app.getHttpServer());
      await login(platformMemberUser.email, agent);
      await agent
        .post('/api/v1/owners')
        .send({ firstName: `Forbidden ${suffix}` })
        .expect(403);
      await agent
        .patch(`/api/v1/patients/${patientNorthId}`)
        .send({ name: `Forbidden ${suffix}` })
        .expect(403);
    } finally {
      await prisma.membership.update({
        where: { id: platformMemberMembershipId },
        data: { role: 'VETERINARIAN' },
      });
    }
  });

  it('requires a same-tenant owner when creating and updating a patient', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    await agent
      .post('/api/v1/patients')
      .send({ ownerId: ownerSouthId, name: 'Invalid relation', species: 'DOG' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await agent
      .post('/api/v1/patients')
      .send({
        ownerId: ownerNorthId,
        name: `Created Patient ${suffix}`,
        species: 'DOG',
        sex: 'UNKNOWN',
        currentWeightKg: 3.5,
        organizationId: organizationSouthId,
      })
      .expect(400);
    const created = await agent
      .post('/api/v1/patients')
      .send({ ownerId: ownerNorthId, name: `Created Patient ${suffix}`, species: 'DOG' })
      .expect(201);
    const updated = await agent
      .patch(`/api/v1/patients/${created.body.id}`)
      .send({ name: `Updated Patient ${suffix}` })
      .expect(200);
    expect(updated.body.name).toBe(`Updated Patient ${suffix}`);
    const archived = await agent.post(`/api/v1/patients/${created.body.id}/archive`).expect(201);
    expect(archived.body.status).toBe('ARCHIVED');
    const archivedList = await agent
      .get('/api/v1/patients')
      .query({ status: 'ARCHIVED', search: `Updated Patient ${suffix}` })
      .expect(200);
    expect(archivedList.body.data[0].id).toBe(created.body.id);
    await agent
      .patch(`/api/v1/patients/${created.body.id}`)
      .send({ notes: 'No edits after archive' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_ARCHIVED'));
  });

  it('denies archive permission to a veterinarian role', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(platformMemberUser.email, agent);
    await agent.post(`/api/v1/owners/${ownerNorthId}/archive`).expect(403);
    await agent.post(`/api/v1/patients/${patientNorthId}/archive`).expect(403);
  });

  it('switches owner and patient visibility with the multi-organization session', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(multiUser.email, agent);
    await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiNorthMembershipId })
      .expect(200);
    const north = await agent.get('/api/v1/patients').expect(200);
    expect(north.body.data.map((patient: { id: string }) => patient.id)).toContain(patientNorthId);
    expect(north.body.data.map((patient: { id: string }) => patient.id)).not.toContain(
      patientSouthId,
    );
    await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiSouthMembershipId })
      .expect(200);
    const south = await agent.get('/api/v1/patients').expect(200);
    expect(south.body.data.map((patient: { id: string }) => patient.id)).toContain(patientSouthId);
    expect(south.body.data.map((patient: { id: string }) => patient.id)).not.toContain(
      patientNorthId,
    );
  });

  it('switches an authenticated session by membership id', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(multiUser.email, agent);
    const response = await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiMembershipIds[1] })
      .expect(200);
    expect(response.body.activeMembership.id).toBe(multiMembershipIds[1]);
    expect(response.body.organizationSelectionRequired).toBe(false);
  });

  it('does not disclose or switch to another user membership', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(multiUser.email, agent);
    await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: foreignMembershipId })
      .expect(404);
  });

  it('rejects suspended memberships and memberships in suspended organizations', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(multiUser.email, agent);
    const firstMultiMembershipId = multiMembershipIds[0];
    if (!firstMultiMembershipId) throw new Error('Expected a multi-organization membership');
    await prisma.membership.update({
      where: { id: firstMultiMembershipId },
      data: { status: 'SUSPENDED' },
    });
    await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: firstMultiMembershipId })
      .expect(404);
    await prisma.membership.update({
      where: { id: firstMultiMembershipId },
      data: { status: 'ACTIVE' },
    });
    await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: suspendedOrganizationMembershipId })
      .expect(404);
  });

  it('rejects a membership id that is not a UUID', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(singleUser.email, agent);
    await agent
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: 'not-a-uuid' })
      .expect(400);
  });

  it('clears an invalid active organization context after suspension', async () => {
    const agent = request.agent(app.getHttpServer());
    const response = await login(singleUser.email, agent);
    const cookie = cookieFrom(response);
    await prisma.membership.update({
      where: { id: singleMembershipId },
      data: { status: 'SUSPENDED' },
    });
    const me = await agent.get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.activeMembership).toBeNull();
    await prisma.membership.update({
      where: { id: singleMembershipId },
      data: { status: 'ACTIVE' },
    });
  });

  it('rejects an expired session', async () => {
    const token = randomBytes(32).toString('base64url');
    await prisma.session.create({
      data: {
        userId: singleUser.id,
        tokenHash: sessions.hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `easyvet_session=${token}`)
      .expect(401);
  });

  it('rejects a revoked session', async () => {
    const token = randomBytes(32).toString('base64url');
    const session = await prisma.session.create({
      data: {
        userId: singleUser.id,
        tokenHash: sessions.hashToken(token),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      },
    });
    createdSessionIds.push(session.id);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `easyvet_session=${token}`)
      .expect(401);
  });

  it('rejects a session after the user is suspended', async () => {
    const response = await login(singleUser.email);
    await prisma.user.update({ where: { id: singleUser.id }, data: { status: 'SUSPENDED' } });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookieFrom(response))
      .expect(401);
    await prisma.user.update({ where: { id: singleUser.id }, data: { status: 'ACTIVE' } });
  });

  it('revokes the database session and clears the cookie on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    const response = await login(singleUser.email, agent);
    const token = tokenFrom(response);
    const before = await prisma.session.findUnique({
      where: { tokenHash: sessions.hashToken(token) },
    });
    await agent
      .post('/api/v1/auth/logout')
      .send({})
      .expect(200)
      .expect({ success: true })
      .expect(({ headers }) => {
        expect(headers['set-cookie']?.[0]).toMatch(/Expires=Thu, 01 Jan 1970/i);
      });
    const after = await prisma.session.findUnique({ where: { id: before!.id } });
    expect(after?.revokedAt).not.toBeNull();
    expect(after?.activeMembershipId).toBeNull();
    await agent.get('/api/v1/auth/me').expect(401);
  });

  it('rejects browser mutations from an unexpected origin', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: singleUser.email, password })
      .expect(403);
  });

  it('requires JSON for browser mutations with a body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(
        `email=${encodeURIComponent(singleUser.email)}&password=${encodeURIComponent(password)}`,
      )
      .expect(415);
  });

  it('updates lastSeenAt when a session is used', async () => {
    const response = await login(singleUser.email);
    const token = tokenFrom(response);
    const before = await prisma.session.findUnique({
      where: { tokenHash: sessions.hashToken(token) },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `easyvet_session=${token}`)
      .expect(200);
    const after = await prisma.session.findUnique({ where: { id: before!.id } });
    expect(after?.lastSeenAt?.getTime()).toBeGreaterThan(before?.lastSeenAt?.getTime() ?? 0);
  });

  it('onboards a new global identity with one-time credentials and enforces first-login password change', async () => {
    const owner = request.agent(app.getHttpServer());
    const concurrentOwner = request.agent(app.getHttpServer());
    await login(singleUser.email, owner);
    await login(singleUser.email, concurrentOwner);
    const email = `onboard-${suffix}@example.local`;
    const responses = await Promise.all([
      owner
        .post('/api/v1/organization/members')
        .send({ email: ` ${email.toUpperCase()} `, membershipRole: 'RECEPTION' }),
      concurrentOwner
        .post('/api/v1/organization/members')
        .send({ email, membershipRole: 'RECEPTION' }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(responses.find(({ status }) => status === 409)?.body.code).toBe(
      'MEMBERSHIP_ALREADY_EXISTS',
    );
    const response = responses.find(({ status }) => status === 201);
    if (!response) throw new Error('One request must win staff onboarding');

    expect(response.body).toMatchObject({ accountAlreadyExisted: false });
    expect(response.body.temporaryPassword).toEqual(expect.any(String));
    expect(response.body.temporaryPassword.length).toBeGreaterThanOrEqual(16);
    expect(response.body.membership).toMatchObject({
      role: 'RECEPTION',
      clinicalRole: null,
      status: 'ACTIVE',
      user: { email, displayName: null },
    });
    expect(response.body.membership.user).not.toHaveProperty('id');
    expect(response.body).not.toHaveProperty('platformRole');

    const created = await prisma.user.findUniqueOrThrow({ where: { email } });
    createdUserIds.push(created.id);
    createdMembershipIds.push(response.body.membership.id);
    expect(created.mustChangePassword).toBe(true);
    expect(created.passwordHash).not.toBe(response.body.temporaryPassword);
    const auditEvent = await prisma.organizationAuditEvent.findFirstOrThrow({
      where: {
        organizationId: organizationNorthId,
        entityType: 'MEMBERSHIP',
        entityId: response.body.membership.id,
      },
    });
    expect(auditEvent.metadata).toEqual({ role: 'RECEPTION', clinicalRole: null });
    expect(JSON.stringify(auditEvent)).not.toContain(response.body.temporaryPassword);
    await expect(
      prisma.organizationAuditEvent.update({
        where: { id: auditEvent.id },
        data: { metadata: { modified: true } },
      }),
    ).rejects.toThrow('append-only');

    const firstSession = request.agent(app.getHttpServer());
    const secondSession = request.agent(app.getHttpServer());
    await firstSession
      .post('/api/v1/auth/login')
      .send({ email, password: response.body.temporaryPassword })
      .expect(200)
      .expect(({ body }) => expect(body.user.mustChangePassword).toBe(true));
    await secondSession
      .post('/api/v1/auth/login')
      .send({ email, password: response.body.temporaryPassword })
      .expect(200);
    await firstSession
      .get('/api/v1/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.user.mustChangePassword).toBe(true));
    await firstSession
      .get('/api/v1/owners')
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('PASSWORD_CHANGE_REQUIRED'));
    await firstSession
      .post('/api/v1/auth/change-password')
      .send({
        currentPassword: 'incorrect-temporary-password',
        newPassword: 'A safe passphrase for first login',
      })
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe('INVALID_CURRENT_PASSWORD'));
    await firstSession
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: response.body.temporaryPassword, newPassword: 'too-short' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('PASSWORD_POLICY_FAILED'));

    const newPassword = 'A safe passphrase for first login 2030';
    await firstSession
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: response.body.temporaryPassword, newPassword })
      .expect(200)
      .expect({ success: true });
    await firstSession
      .get('/api/v1/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.user.mustChangePassword).toBe(false));
    await secondSession.get('/api/v1/auth/me').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: response.body.temporaryPassword })
      .expect(401);

    const staff = request.agent(app.getHttpServer());
    await staff.post('/api/v1/auth/login').send({ email, password: newPassword }).expect(200);
    await owner
      .patch(`/api/v1/organization/members/${response.body.membership.id}`)
      .send({ membershipRole: 'ADMIN' })
      .expect(200);
    await staff
      .get('/api/v1/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.activeMembership.permissions).toContain('members.read'));
  });

  it('adds an existing identity without changing its password or exposing its other organizations', async () => {
    const owner = request.agent(app.getHttpServer());
    await login(singleUser.email, owner);
    const passwordHash = (await prisma.user.findUniqueOrThrow({ where: { id: foreignUser.id } }))
      .passwordHash;
    const response = await owner
      .post('/api/v1/organization/members')
      .send({
        email: foreignUser.email.toUpperCase(),
        membershipRole: 'RECEPTION',
        clinicalRole: 'PRACTITIONER',
      })
      .expect(201);

    expect(response.body).toMatchObject({ accountAlreadyExisted: true, temporaryPassword: null });
    expect(response.body.membership).toMatchObject({
      role: 'RECEPTION',
      clinicalRole: 'PRACTITIONER',
      status: 'ACTIVE',
    });
    expect(response.body.membership).not.toHaveProperty('organizationId');
    expect(response.body.membership).not.toHaveProperty('user.id');
    expect(response.body.membership).not.toHaveProperty('memberships');
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: foreignUser.id } })).passwordHash,
    ).toBe(passwordHash);
    createdMembershipIds.push(response.body.membership.id);

    await owner.get(`/api/v1/organization/members/${foreignMembershipId}`).expect(404);
    const details = await owner
      .get(`/api/v1/organization/members/${response.body.membership.id}`)
      .expect(200);
    expect(details.body).toMatchObject({ role: 'RECEPTION', clinicalRole: 'PRACTITIONER' });
    expect(details.body).not.toHaveProperty('platformRole');
  });

  it('deduplicates concurrent onboarding of one new identity across two organizations', async () => {
    const northOwner = request.agent(app.getHttpServer());
    const foreignOwner = request.agent(app.getHttpServer());
    await login(singleUser.email, northOwner);
    await login(foreignUser.email, foreignOwner);
    await foreignOwner
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: foreignMembershipId })
      .expect(200);
    const email = `multi-org-onboard-${suffix}@example.local`;
    const responses = await Promise.all([
      northOwner.post('/api/v1/organization/members').send({ email, membershipRole: 'RECEPTION' }),
      foreignOwner.post('/api/v1/organization/members').send({ email, membershipRole: 'GROOMER' }),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    const newAccount = responses.find(({ body }) => body.accountAlreadyExisted === false);
    const existingAccount = responses.find(({ body }) => body.accountAlreadyExisted === true);
    expect(newAccount?.body.temporaryPassword).toEqual(expect.any(String));
    expect(existingAccount?.body.temporaryPassword).toBeNull();
    expect(newAccount?.body.temporaryPassword).not.toBe(existingAccount?.body.temporaryPassword);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    createdUserIds.push(user.id);
    const memberships = await prisma.membership.findMany({ where: { userId: user.id } });
    createdMembershipIds.push(...memberships.map(({ id }) => id));
    expect(user.mustChangePassword).toBe(true);
    expect(memberships.map(({ organizationId: orgId }) => orgId).sort()).toEqual(
      [
        organizationNorthId,
        (await prisma.membership.findUniqueOrThrow({ where: { id: foreignMembershipId } }))
          .organizationId,
      ].sort(),
    );
    expect(memberships).toHaveLength(2);
  });

  it('enforces tenant report permissions and civil date boundaries', async () => {
    const owner = request.agent(app.getHttpServer());
    await login(singleUser.email, owner);
    const operational = await owner
      .get('/api/v1/reports/operational')
      .query({ from: '2030-01-08', to: '2030-01-08' })
      .expect(200);
    expect(operational.body.range).toMatchObject({
      from: '2030-01-08',
      to: '2030-01-08',
      timezone: 'UTC',
      clinicLocationId: null,
    });
    expect(operational.body.appointments).toMatchObject({
      total: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    });
    expect(operational.body).not.toHaveProperty('patients');
    await owner.get('/api/v1/reports/clinical').expect(200);
    await owner.get('/api/v1/reports/commercial').expect(200);
    await owner.get('/api/v1/reports/inventory').expect(200);
    await owner
      .get('/api/v1/reports/operational')
      .query({ from: '2030-01-08', to: '2031-01-09' })
      .expect(400);
    await owner
      .get('/api/v1/reports/operational')
      .query({ from: '2030-02-30', to: '2030-03-01' })
      .expect(400);
    await owner
      .get('/api/v1/reports/operational')
      .query({ clinicLocationId: locationSouthId })
      .expect(404);

    const receptionist = request.agent(app.getHttpServer());
    await login(limitedUser.email, receptionist);
    await receptionist.get('/api/v1/reports/operational').expect(200);
    await receptionist.get('/api/v1/reports/commercial').expect(403);
    await receptionist.get('/api/v1/reports/inventory').expect(403);
    await receptionist.get('/api/v1/reports/clinical').expect(403);

    const veterinarian = request.agent(app.getHttpServer());
    await login(multiUser.email, veterinarian);
    await veterinarian
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiSouthMembershipId })
      .expect(200);
    await veterinarian.get('/api/v1/organization/current').expect(200);
    await veterinarian.get('/api/v1/organization/settings').expect(403);
    await veterinarian.get('/api/v1/organization/locations').expect(200);
    await veterinarian.get('/api/v1/reports/operational').expect(200);
  });

  it('supports safe settings and reversible clinic-location management', async () => {
    const owner = request.agent(app.getHttpServer());
    await login(singleUser.email, owner);
    await owner
      .patch('/api/v1/organization/current')
      .send({ timezone: 'Mars/Olympus' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('INVALID_TIMEZONE'));

    try {
      const commercial = await owner
        .patch('/api/v1/organization/commercial-settings')
        .send({ currencyCode: 'usd', invoicePrefix: 'qa-10' })
        .expect(200);
      expect(commercial.body).toEqual({ currencyCode: 'USD', invoicePrefix: 'QA-10' });
      expect(commercial.body).not.toHaveProperty('nextInvoiceNumber');
    } finally {
      await prisma.organizationCommercialSettings.update({
        where: { organizationId: organizationNorthId },
        data: { currencyCode: 'COP', invoicePrefix: 'AUTH' },
      });
      await prisma.organization.update({
        where: { id: organizationNorthId },
        data: { currencyCode: 'COP' },
      });
    }

    const created = await owner
      .post('/api/v1/organization/locations')
      .send({
        name: `QA Location ${suffix}`,
        address: 'Calle ficticia 10',
        city: 'Bogotá',
      })
      .expect(201);
    createdLocationIds.push(created.body.id);
    expect(created.body).toMatchObject({ status: 'ACTIVE', city: 'Bogotá' });
    const updated = await owner
      .patch(`/api/v1/organization/locations/${created.body.id}`)
      .send({ name: `QA Location Updated ${suffix}` })
      .expect(200);
    expect(updated.body.name).toBe(`QA Location Updated ${suffix}`);
    await owner
      .post(`/api/v1/organization/locations/${created.body.id}/deactivate`)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('SUSPENDED'));
    await owner
      .post(`/api/v1/organization/locations/${created.body.id}/activate`)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('ACTIVE'));
    await owner.get(`/api/v1/organization/locations/${locationSouthId}`).expect(404);
  });

  it('refreshes permissions after role changes and keeps OWNER management restricted', async () => {
    const owner = request.agent(app.getHttpServer());
    await login(singleUser.email, owner);
    const administrator = request.agent(app.getHttpServer());
    await login(multiUser.email, administrator);
    await administrator
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiNorthMembershipId })
      .expect(200);

    await administrator
      .patch(`/api/v1/organization/members/${singleMembershipId}`)
      .send({ membershipRole: 'ADMIN' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('OWNER_PERMISSION_REQUIRED'));
    await administrator
      .post(`/api/v1/organization/members/${singleMembershipId}/suspend`)
      .expect(403);
    await owner
      .patch(`/api/v1/organization/members/${singleMembershipId}`)
      .send({ membershipRole: 'ADMIN' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('LAST_ACTIVE_OWNER_REQUIRED'));
    await owner
      .post(`/api/v1/organization/members/${singleMembershipId}/suspend`)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('LAST_ACTIVE_OWNER_REQUIRED'));

    await owner
      .patch(`/api/v1/organization/members/${multiNorthMembershipId}`)
      .send({ membershipRole: 'RECEPTION', clinicalRole: null })
      .expect(200);
    await administrator.get('/api/v1/organization/members').expect(403);
    await administrator.get('/api/v1/reports/clinical').expect(403);
    await owner
      .patch(`/api/v1/organization/members/${multiNorthMembershipId}`)
      .send({ clinicalRole: 'PRACTITIONER' })
      .expect(200);
    await administrator.get('/api/v1/reports/clinical').expect(200);
    await administrator.get('/api/v1/reports/commercial').expect(403);
    await owner
      .patch(`/api/v1/organization/members/${multiNorthMembershipId}`)
      .send({ membershipRole: 'ADMIN', clinicalRole: null })
      .expect(200);
  });

  it('suspends only the selected organization session and does not revive it on reactivation', async () => {
    const owner = request.agent(app.getHttpServer());
    await login(singleUser.email, owner);
    const north = request.agent(app.getHttpServer());
    const south = request.agent(app.getHttpServer());
    await login(multiUser.email, north);
    await login(multiUser.email, south);
    await north
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiNorthMembershipId })
      .expect(200);
    await south
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiSouthMembershipId })
      .expect(200);

    await owner.post(`/api/v1/organization/members/${multiNorthMembershipId}/suspend`).expect(201);
    await north.get('/api/v1/auth/me').expect(401);
    await south
      .get('/api/v1/auth/me')
      .expect(200)
      .expect(({ body }) => expect(body.activeMembership.id).toBe(multiSouthMembershipId));
    await owner
      .post(`/api/v1/organization/members/${multiNorthMembershipId}/reactivate`)
      .expect(201);
    await north.get('/api/v1/auth/me').expect(401);

    const freshNorth = request.agent(app.getHttpServer());
    await login(multiUser.email, freshNorth);
    await freshNorth
      .post('/api/v1/auth/switch-organization')
      .send({ membershipId: multiNorthMembershipId })
      .expect(200);
    await freshNorth.get('/api/v1/auth/me').expect(200);
  });

  it('serializes concurrent owner demotion attempts and preserves one active owner', async () => {
    const memberships = app.get(MembershipsService);
    await prisma.membership.update({
      where: { id: multiNorthMembershipId },
      data: { role: MembershipRole.OWNER },
    });
    try {
      const outcomes = await Promise.allSettled([
        memberships.suspendStaff(
          organizationNorthId,
          singleMembershipId,
          multiNorthMembershipId,
          MembershipRole.OWNER,
        ),
        memberships.suspendStaff(
          organizationNorthId,
          multiNorthMembershipId,
          singleMembershipId,
          MembershipRole.OWNER,
        ),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
      expect(rejected?.status).toBe('rejected');
      if (rejected?.status === 'rejected') {
        expect(rejected.reason.getStatus()).toBe(409);
        expect(rejected.reason.getResponse()).toMatchObject({ code: 'LAST_ACTIVE_OWNER_REQUIRED' });
      }
      const activeOwners = await prisma.membership.count({
        where: {
          organizationId: organizationNorthId,
          role: MembershipRole.OWNER,
          status: 'ACTIVE',
        },
      });
      expect(activeOwners).toBe(1);
    } finally {
      await prisma.membership.update({
        where: { id: singleMembershipId },
        data: { role: MembershipRole.OWNER, status: 'ACTIVE' },
      });
      await prisma.membership.update({
        where: { id: multiNorthMembershipId },
        data: { role: MembershipRole.ADMIN, status: 'ACTIVE' },
      });
    }
  });
});
