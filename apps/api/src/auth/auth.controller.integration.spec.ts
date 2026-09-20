import { randomBytes } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlatformRole, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppModule } from '../app.module';
import { ApiExceptionFilter } from '../http/api-exception.filter';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';

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
  let singleUser: { id: string; email: string };
  let multiUser: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let suspendedUser: { id: string; email: string };
  let singleMembershipId: string;
  let multiMembershipIds: string[];
  let foreignMembershipId: string;
  let suspendedOrganizationMembershipId: string;

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
    process.env.DATABASE_URL = databaseUrl;

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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

    const [single, multi, admin, suspended, foreign] = await Promise.all([
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
    ]);
    createdUserIds.push(single.id, multi.id, admin.id, suspended.id, foreign.id);
    singleUser = single;
    multiUser = multi;
    adminUser = admin;
    suspendedUser = suspended;

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
      ],
    });
    singleMembershipId = memberships.find((membership) => membership.userId === single.id)!.id;
    multiMembershipIds = memberships
      .filter(
        (membership) =>
          membership.userId === multi.id && membership.organizationId !== organizationSuspended.id,
      )
      .map((membership) => membership.id);
    foreignMembershipId = memberships.find((membership) => membership.userId === foreign.id)!.id;
    suspendedOrganizationMembershipId = memberships.find(
      (membership) => membership.organizationId === organizationSuspended.id,
    )!.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
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
    });
    expect(response.body.activeMembership.id).toBe(singleMembershipId);
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
});
