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

const seedOwners = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    organizationId: seedOrganizations[0].id,
    firstName: 'Camila',
    lastName: 'Rojas',
    documentType: 'NATIONAL_ID',
    documentNumber: 'DEMO-1001',
    email: 'camila.rojas@demo.local',
    phone: '+57 300 000 1001',
    city: 'Bogotá',
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    organizationId: seedOrganizations[0].id,
    firstName: 'Andrés',
    lastName: 'Gil',
    documentType: 'NATIONAL_ID',
    documentNumber: 'DEMO-1002',
    email: 'andres.gil@demo.local',
    phone: '+57 300 000 1002',
    city: 'Bogotá',
  },
  {
    id: '00000000-0000-4000-8000-000000000303',
    organizationId: seedOrganizations[1].id,
    firstName: 'Valentina',
    lastName: 'Mora',
    documentType: 'NATIONAL_ID',
    documentNumber: 'DEMO-2001',
    email: 'valentina.mora@demo.local',
    phone: '+57 300 000 2001',
    city: 'Bogotá',
  },
  {
    id: '00000000-0000-4000-8000-000000000304',
    organizationId: seedOrganizations[1].id,
    firstName: 'Sofía',
    lastName: 'Torres',
    documentType: 'NATIONAL_ID',
    documentNumber: 'DEMO-2002',
    email: 'sofia.torres@demo.local',
    phone: '+57 300 000 2002',
    city: 'Bogotá',
  },
];

const seedPatients = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    organizationId: seedOrganizations[0].id,
    ownerId: seedOwners[0].id,
    name: 'Luna',
    species: 'DOG',
    breed: 'Mestiza',
    sex: 'FEMALE',
    currentWeightKg: 12.4,
  },
  {
    id: '00000000-0000-4000-8000-000000000402',
    organizationId: seedOrganizations[0].id,
    ownerId: seedOwners[0].id,
    name: 'Bruno',
    species: 'DOG',
    breed: 'Labrador',
    sex: 'MALE',
    currentWeightKg: 24.1,
  },
  {
    id: '00000000-0000-4000-8000-000000000403',
    organizationId: seedOrganizations[0].id,
    ownerId: seedOwners[1].id,
    name: 'Nala',
    species: 'CAT',
    breed: 'Criolla',
    sex: 'FEMALE',
    currentWeightKg: 4.2,
  },
  {
    id: '00000000-0000-4000-8000-000000000404',
    organizationId: seedOrganizations[1].id,
    ownerId: seedOwners[2].id,
    name: 'Milo',
    species: 'CAT',
    breed: 'Criollo',
    sex: 'MALE',
    currentWeightKg: 5.1,
  },
  {
    id: '00000000-0000-4000-8000-000000000405',
    organizationId: seedOrganizations[1].id,
    ownerId: seedOwners[2].id,
    name: 'Kira',
    species: 'DOG',
    breed: 'Beagle',
    sex: 'FEMALE',
    currentWeightKg: 9.8,
  },
  {
    id: '00000000-0000-4000-8000-000000000406',
    organizationId: seedOrganizations[1].id,
    ownerId: seedOwners[3].id,
    name: 'Simba',
    species: 'DOG',
    breed: 'Mestizo',
    sex: 'MALE',
    currentWeightKg: 17.6,
  },
];

const seedAvailabilityRules = [
  {
    id: '00000000-0000-4000-8000-000000000501',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    membershipId: null,
    dayOfWeek: 2,
    startLocalTime: '08:00',
    endLocalTime: '18:00',
    slotMinutes: 30,
  },
  {
    id: '00000000-0000-4000-8000-000000000502',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    membershipId: seedUsers[2].membershipId,
    dayOfWeek: 2,
    startLocalTime: '09:00',
    endLocalTime: '17:00',
    slotMinutes: 30,
  },
  {
    id: '00000000-0000-4000-8000-000000000503',
    organizationId: seedOrganizations[1].id,
    clinicLocationId: seedOrganizations[1].locationId,
    membershipId: null,
    dayOfWeek: 2,
    startLocalTime: '08:00',
    endLocalTime: '18:00',
    slotMinutes: 30,
  },
];

const seedAppointments = [
  {
    id: '00000000-0000-4000-8000-000000000601',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    patientId: seedPatients[0].id,
    ownerId: seedOwners[0].id,
    assignedMembershipId: seedUsers[2].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    status: 'SCHEDULED',
    startsAt: '2030-01-08T14:00:00.000Z',
    endsAt: '2030-01-08T14:30:00.000Z',
    reason: 'Control general',
  },
  {
    id: '00000000-0000-4000-8000-000000000602',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    patientId: seedPatients[1].id,
    ownerId: seedOwners[0].id,
    assignedMembershipId: null,
    createdByMembershipId: seedUsers[0].membershipId,
    status: 'WAITING_ROOM',
    startsAt: '2030-01-08T15:00:00.000Z',
    endsAt: '2030-01-08T15:30:00.000Z',
    reason: 'Vacunación',
  },
  {
    id: '00000000-0000-4000-8000-000000000603',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    patientId: seedPatients[2].id,
    ownerId: seedOwners[1].id,
    assignedMembershipId: seedUsers[0].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    status: 'COMPLETED',
    startsAt: '2030-01-07T14:00:00.000Z',
    endsAt: '2030-01-07T14:30:00.000Z',
    reason: 'Consulta completada',
  },
  {
    id: '00000000-0000-4000-8000-000000000604',
    organizationId: seedOrganizations[0].id,
    clinicLocationId: seedOrganizations[0].locationId,
    patientId: seedPatients[2].id,
    ownerId: seedOwners[1].id,
    assignedMembershipId: seedUsers[0].membershipId,
    createdByMembershipId: seedUsers[0].membershipId,
    status: 'CANCELLED',
    startsAt: '2030-01-08T16:00:00.000Z',
    endsAt: '2030-01-08T16:30:00.000Z',
    reason: 'Cirugía cancelada',
    cancelledAt: '2029-12-20T12:00:00.000Z',
    cancelledByMembershipId: seedUsers[0].membershipId,
    cancellationReason: 'Reprogramada por el cliente',
  },
  {
    id: '00000000-0000-4000-8000-000000000605',
    organizationId: seedOrganizations[1].id,
    clinicLocationId: seedOrganizations[1].locationId,
    patientId: seedPatients[3].id,
    ownerId: seedOwners[2].id,
    assignedMembershipId: '00000000-0000-4000-8000-000000000204',
    createdByMembershipId: '00000000-0000-4000-8000-000000000202',
    status: 'SCHEDULED',
    startsAt: '2030-01-08T14:00:00.000Z',
    endsAt: '2030-01-08T14:30:00.000Z',
    reason: 'Consulta Sur',
  },
  {
    id: '00000000-0000-4000-8000-000000000606',
    organizationId: seedOrganizations[1].id,
    clinicLocationId: seedOrganizations[1].locationId,
    patientId: seedPatients[4].id,
    ownerId: seedOwners[2].id,
    assignedMembershipId: null,
    createdByMembershipId: '00000000-0000-4000-8000-000000000202',
    status: 'COMPLETED',
    startsAt: '2030-01-07T14:00:00.000Z',
    endsAt: '2030-01-07T14:30:00.000Z',
    reason: 'Control Sur',
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
      update: { role: 'VETERINARIAN', status: 'ACTIVE' },
      create: {
        id: '00000000-0000-4000-8000-000000000204',
        userId: seedUsers[2].id,
        organizationId: seedOrganizations[1].id,
        role: 'VETERINARIAN',
        status: 'ACTIVE',
      },
    });

    for (const owner of seedOwners) {
      const documentNumberNormalized = owner.documentNumber.toUpperCase();
      await transaction.owner.upsert({
        where: { id: owner.id },
        update: {
          organizationId: owner.organizationId,
          firstName: owner.firstName,
          lastName: owner.lastName,
          documentType: owner.documentType,
          documentNumber: owner.documentNumber,
          documentNumberNormalized,
          email: owner.email,
          phone: owner.phone,
          city: owner.city,
          status: 'ACTIVE',
          archivedAt: null,
        },
        create: {
          id: owner.id,
          organizationId: owner.organizationId,
          firstName: owner.firstName,
          lastName: owner.lastName,
          documentType: owner.documentType,
          documentNumber: owner.documentNumber,
          documentNumberNormalized,
          email: owner.email,
          phone: owner.phone,
          city: owner.city,
          status: 'ACTIVE',
        },
      });
    }

    for (const patient of seedPatients) {
      await transaction.patient.upsert({
        where: { id: patient.id },
        update: {
          organizationId: patient.organizationId,
          ownerId: patient.ownerId,
          name: patient.name,
          nameNormalized: patient.name.toLocaleLowerCase(),
          species: patient.species,
          breed: patient.breed,
          sex: patient.sex,
          currentWeightKg: patient.currentWeightKg,
          status: 'ACTIVE',
          archivedAt: null,
        },
        create: {
          id: patient.id,
          organizationId: patient.organizationId,
          ownerId: patient.ownerId,
          name: patient.name,
          nameNormalized: patient.name.toLocaleLowerCase(),
          species: patient.species,
          breed: patient.breed,
          sex: patient.sex,
          currentWeightKg: patient.currentWeightKg,
          status: 'ACTIVE',
        },
      });
    }

    for (const rule of seedAvailabilityRules) {
      await transaction.availabilityRule.upsert({
        where: { id: rule.id },
        update: { ...rule, isActive: true, notes: null },
        create: { ...rule, isActive: true, notes: null },
      });
    }

    for (const appointment of seedAppointments) {
      await transaction.appointment.upsert({
        where: { id: appointment.id },
        update: {
          ...appointment,
          startsAt: new Date(appointment.startsAt),
          endsAt: new Date(appointment.endsAt),
          cancelledAt: appointment.cancelledAt ? new Date(appointment.cancelledAt) : null,
        },
        create: {
          ...appointment,
          startsAt: new Date(appointment.startsAt),
          endsAt: new Date(appointment.endsAt),
          cancelledAt: appointment.cancelledAt ? new Date(appointment.cancelledAt) : null,
        },
      });
    }
  });

  console.log(
    'Development seed applied: 2 organizations, 2 locations, 3 users, 4 memberships, 4 owners, 6 patients, 3 availability rules, 6 appointments.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
