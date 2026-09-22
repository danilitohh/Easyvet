import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PrismaService } from './prisma.service';
import { UsersService } from '../../users/users.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const testPasswordHash =
  '$argon2id$v=19$m=65536,t=3,p=4$Nr1R/Hrj9hTne88KZa4DPw$TT2XYfwCUrLqlnU/9pbs/gM+Arh9ZKFqTrIU1Vc8HA4';

describeDatabase('fundamental multi-tenant model', () => {
  let prisma: PrismaClient;
  let users: UsersService;
  const suffix = Date.now().toString();
  const createdOrganizationIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    }

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    users = new UsersService(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.clinicLocation.deleteMany({
      where: { organizationId: { in: createdOrganizationIds } },
    });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('normalizes user email before applying the global unique constraint', async () => {
    const email = `Case-${suffix}@Example.Local`;
    const user = await users.create({ email, passwordHash: testPasswordHash });
    createdUserIds.push(user.id);

    expect(user.email).toBe(email.toLowerCase());
    await expect(
      users.create({ email: email.toUpperCase(), passwordHash: testPasswordHash }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces unique organization slugs', async () => {
    const slug = `model-test-${suffix}`;
    const organization = await prisma.organization.create({
      data: { name: 'Model Test', slug },
    });
    createdOrganizationIds.push(organization.id);

    await expect(
      prisma.organization.create({ data: { name: 'Duplicate', slug } }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('allows one user to belong to two organizations without duplicate memberships', async () => {
    const user = await prisma.user.create({
      data: { email: `multi-${suffix}@example.local`, passwordHash: testPasswordHash },
    });
    createdUserIds.push(user.id);
    const organizations = await Promise.all([
      prisma.organization.create({ data: { name: 'North', slug: `north-${suffix}` } }),
      prisma.organization.create({ data: { name: 'South', slug: `south-${suffix}` } }),
    ]);
    createdOrganizationIds.push(...organizations.map(({ id }) => id));

    await prisma.membership.createMany({
      data: organizations.map(({ id }) => ({
        userId: user.id,
        organizationId: id,
        role: 'OWNER' as const,
        status: 'ACTIVE' as const,
      })),
    });

    await expect(
      prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organizations[0].id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const memberships = await prisma.membership.findMany({ where: { userId: user.id } });
    expect(memberships).toHaveLength(2);
  });

  it('supports multiple clinic locations and preserves organization relations', async () => {
    const organization = await prisma.organization.create({
      data: { name: 'Locations Test', slug: `locations-${suffix}` },
    });
    createdOrganizationIds.push(organization.id);
    await prisma.clinicLocation.createMany({
      data: [
        { organizationId: organization.id, name: 'North Branch' },
        { organizationId: organization.id, name: 'South Branch' },
      ],
    });

    const result = await prisma.organization.findUnique({
      where: { id: organization.id },
      include: { clinicLocations: true, memberships: true },
    });
    expect(result?.clinicLocations).toHaveLength(2);
    expect(result?.memberships).toHaveLength(0);
  });

  it('keeps the development seed idempotent', async () => {
    const seedPathCandidates = [
      resolve(process.cwd(), 'prisma/seed.mjs'),
      resolve(process.cwd(), '../../prisma/seed.mjs'),
    ];
    const seedPath = seedPathCandidates.find((candidate) => existsSync(candidate));
    if (!seedPath) {
      throw new Error('Could not locate prisma/seed.mjs');
    }
    const environment = { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST };

    // Run the real seed twice against the isolated database, never the dev database.
    const repositoryRoot = resolve(seedPath, '..', '..');
    execFileSync(process.execPath, [seedPath], { cwd: repositoryRoot, env: environment });
    execFileSync(process.execPath, [seedPath], { cwd: repositoryRoot, env: environment });

    const [
      organizations,
      locations,
      users,
      memberships,
      owners,
      patients,
      profiles,
      records,
      encounters,
      procedures,
      surgeryDetails,
      anesthesiaRecords,
      anesthesiaObservations,
      prescriptions,
      prescriptionItems,
      vaccinations,
      dewormings,
      vitals,
      evolutions,
      audits,
    ] = await Promise.all([
      prisma.organization.count({ where: { slug: { startsWith: 'veterinaria-demo-' } } }),
      prisma.clinicLocation.count({ where: { name: { startsWith: 'Sede ' } } }),
      prisma.user.count({ where: { email: { endsWith: '@demo.local' } } }),
      prisma.membership.count({ where: { user: { email: { endsWith: '@demo.local' } } } }),
      prisma.owner.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.patient.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.membershipProfessionalProfile.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.clinicalRecord.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.clinicalEncounter.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.clinicalProcedure.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.clinicalSurgeryDetail.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.anesthesiaRecord.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.anesthesiaObservation.count({
        where: {
          anesthesiaRecord: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
        },
      }),
      prisma.prescription.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.prescriptionItem.count({
        where: { prescription: { organization: { slug: { startsWith: 'veterinaria-demo-' } } } },
      }),
      prisma.vaccination.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.deworming.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.vitalMeasurement.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.clinicalEvolution.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
      prisma.clinicalAuditEvent.count({
        where: { organization: { slug: { startsWith: 'veterinaria-demo-' } } },
      }),
    ]);

    expect({
      organizations,
      locations,
      users,
      memberships,
      owners,
      patients,
      profiles,
      records,
      encounters,
      procedures,
      surgeryDetails,
      anesthesiaRecords,
      anesthesiaObservations,
      prescriptions,
      prescriptionItems,
      vaccinations,
      dewormings,
      vitals,
      evolutions,
      audits,
    }).toEqual({
      organizations: 2,
      locations: 2,
      users: 3,
      memberships: 4,
      owners: 4,
      patients: 6,
      profiles: 2,
      records: 2,
      encounters: 4,
      procedures: 5,
      surgeryDetails: 2,
      anesthesiaRecords: 3,
      anesthesiaObservations: 3,
      prescriptions: 3,
      prescriptionItems: 3,
      vaccinations: 2,
      dewormings: 3,
      vitals: 2,
      evolutions: 1,
      audits: 33,
    });
  });
});
