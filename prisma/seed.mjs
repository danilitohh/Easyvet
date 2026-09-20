import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const demoPassword = process.env.EASYVET_DEMO_PASSWORD ?? 'EasyvetDemo!2026';

const seedOrganizations = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Veterinaria Demo Norte',
    slug: 'veterinaria-demo-norte',
    locationId: '00000000-0000-4000-8000-000000000011',
    locationName: 'Sede Norte',
    city: 'Bogotá',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Veterinaria Demo Sur',
    slug: 'veterinaria-demo-sur',
    locationId: '00000000-0000-4000-8000-000000000012',
    locationName: 'Sede Sur',
    city: 'Bogotá',
  },
];

const seedUsers = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    email: 'owner.norte@demo.local',
    organizationId: seedOrganizations[0].id,
    membershipId: '00000000-0000-4000-8000-000000000201',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    email: 'owner.sur@demo.local',
    organizationId: seedOrganizations[1].id,
    membershipId: '00000000-0000-4000-8000-000000000202',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    email: 'multi@demo.local',
    organizationId: seedOrganizations[0].id,
    membershipId: '00000000-0000-4000-8000-000000000203',
  },
];

async function main() {
  // Hash the local-only demo credential with Argon2id; plaintext never reaches PostgreSQL.
  const passwordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });

  await prisma.$transaction(async (transaction) => {
    for (const organization of seedOrganizations) {
      await transaction.organization.upsert({
        where: { slug: organization.slug },
        update: {
          name: organization.name,
          status: 'ACTIVE',
          timezone: 'America/Bogota',
          locale: 'es-CO',
          currencyCode: 'COP',
        },
        create: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: 'ACTIVE',
          timezone: 'America/Bogota',
          locale: 'es-CO',
          currencyCode: 'COP',
        },
      });

      await transaction.clinicLocation.upsert({
        where: { id: organization.locationId },
        update: {
          organizationId: organization.id,
          name: organization.locationName,
          status: 'ACTIVE',
          address: 'Dirección demo local',
          city: organization.city,
        },
        create: {
          id: organization.locationId,
          organizationId: organization.id,
          name: organization.locationName,
          status: 'ACTIVE',
          address: 'Dirección demo local',
          city: organization.city,
        },
      });
    }

    for (const user of seedUsers) {
      await transaction.user.upsert({
        where: { email: user.email },
        update: {
          passwordHash,
          status: 'ACTIVE',
          platformRole: 'USER',
        },
        create: {
          id: user.id,
          email: user.email,
          passwordHash,
          status: 'ACTIVE',
          platformRole: 'USER',
        },
      });

      await transaction.membership.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: user.organizationId,
          },
        },
        update: { role: 'OWNER', status: 'ACTIVE' },
        create: {
          id: user.membershipId,
          userId: user.id,
          organizationId: user.organizationId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
    }

    // The multi-organization identity proves a user can belong to both tenants.
    await transaction.membership.upsert({
      where: {
        userId_organizationId: {
          userId: seedUsers[2].id,
          organizationId: seedOrganizations[1].id,
        },
      },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: {
        id: '00000000-0000-4000-8000-000000000204',
        userId: seedUsers[2].id,
        organizationId: seedOrganizations[1].id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
  });

  console.log('Development seed applied: 2 organizations, 2 locations, 3 users, 4 memberships.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
