import { PrismaClient } from '@prisma/client';
import { AppointmentStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { TenantContext } from '../authorization/authorization.types';
import { AppointmentsService } from '../appointments/appointments.service';
import { PatientsService } from '../patients/patients.service';
import type { CreateGroomingVisitDto } from './grooming.dto';
import { GroomingService } from './grooming.service';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

// These tests use only DATABASE_URL_TEST and exercise PostgreSQL row locks, constraints and tenant FKs.
describeDatabase('grooming service', () => {
  let prisma: PrismaClient;
  let grooming: GroomingService;
  let patients: PatientsService;
  let agenda: AppointmentsService;
  let organizationId: string;
  let foreignOrganizationId: string;
  let patientId: string;
  let foreignPatientId: string;
  let ownerId: string;
  let locationId: string;
  let foreignLocationId: string;
  let appointmentId: string;
  let cancelledAppointmentId: string;
  let owner: TenantContext;
  let groomer: TenantContext;
  let otherGroomer: TenantContext;
  let receptionist: TenantContext;
  let foreignOwner: TenantContext;
  const suffix = Date.now().toString(36);
  const organizations: string[] = [];
  const users: string[] = [];
  const memberships: string[] = [];
  const owners: string[] = [];
  const patientsIds: string[] = [];
  const locations: string[] = [];
  const appointments: string[] = [];
  const visits: string[] = [];
  let appointmentFixtureIndex = 0;

  // Appointment fixtures deliberately stay within a single tenant, patient and clinic location.
  async function makeAppointment(status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED') {
    const startsAt = new Date(
      Date.parse('2035-01-08T15:00:00.000Z') + appointmentFixtureIndex++ * 60 * 60_000,
    );
    const appointment = await prisma.appointment.create({
      data: {
        organizationId,
        clinicLocationId: locationId,
        patientId,
        ownerId,
        createdByMembershipId: owner.membershipId,
        status: 'SCHEDULED',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        reason: 'Cita ficticia de Grooming QA',
      },
    });
    if (status === 'CANCELLED') {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByMembershipId: owner.membershipId,
        },
      });
    }
    appointments.push(appointment.id);
    return appointment.id;
  }

  // Creates fake draft rows through the public domain service so every test exercises the same invariants.
  async function createDraft(
    actor: TenantContext = owner,
    overrides: Partial<CreateGroomingVisitDto> = {},
    targetPatientId = patientId,
  ) {
    const record = await grooming.create(actor, targetPatientId, {
      clinicLocationId: locationId,
      serviceSummary: 'Baño y cepillado de QA',
      assignedGroomerMembershipId: groomer.membershipId,
      ...overrides,
    });
    visits.push(record.id);
    return record;
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL_TEST;
    if (!url) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    if (new URL(url).pathname.replace(/^\//, '') !== 'easyvet_test') {
      throw new Error('Grooming database tests must use easyvet_test');
    }
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    grooming = new GroomingService(prisma as never);
    patients = new PatientsService(prisma as never);
    agenda = new AppointmentsService(prisma as never);

    const [organization, foreignOrganization] = await Promise.all([
      prisma.organization.create({
        data: { name: `Grooming QA ${suffix}`, slug: `grooming-qa-${suffix}` },
      }),
      prisma.organization.create({
        data: { name: `Grooming Foreign QA ${suffix}`, slug: `grooming-foreign-qa-${suffix}` },
      }),
    ]);
    organizationId = organization.id;
    foreignOrganizationId = foreignOrganization.id;
    organizations.push(organizationId, foreignOrganizationId);

    const createdUsers = await Promise.all(
      ['owner', 'groomer', 'other-groomer', 'reception', 'foreign'].map((name) =>
        prisma.user.create({
          data: {
            email: `grooming-${name}-${suffix}@example.local`,
            passwordHash: 'integration-only',
          },
        }),
      ),
    );
    users.push(...createdUsers.map((user) => user.id));
    const [
      ownerMembership,
      groomerMembership,
      otherGroomerMembership,
      receptionMembership,
      foreignMembership,
    ] = await Promise.all([
      prisma.membership.create({
        data: { userId: createdUsers[0]!.id, organizationId, role: 'OWNER', status: 'ACTIVE' },
      }),
      prisma.membership.create({
        data: { userId: createdUsers[1]!.id, organizationId, role: 'GROOMER', status: 'ACTIVE' },
      }),
      prisma.membership.create({
        data: { userId: createdUsers[2]!.id, organizationId, role: 'GROOMER', status: 'ACTIVE' },
      }),
      prisma.membership.create({
        data: {
          userId: createdUsers[3]!.id,
          organizationId,
          role: 'RECEPTION',
          status: 'ACTIVE',
        },
      }),
      prisma.membership.create({
        data: {
          userId: createdUsers[4]!.id,
          organizationId: foreignOrganizationId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      }),
    ]);
    memberships.push(
      ownerMembership.id,
      groomerMembership.id,
      otherGroomerMembership.id,
      receptionMembership.id,
      foreignMembership.id,
    );
    owner = {
      organizationId,
      membershipId: ownerMembership.id,
      role: 'OWNER',
      clinicalRole: null,
      userId: createdUsers[0]!.id,
    };
    groomer = {
      organizationId,
      membershipId: groomerMembership.id,
      role: 'GROOMER',
      clinicalRole: null,
      userId: createdUsers[1]!.id,
    };
    otherGroomer = {
      organizationId,
      membershipId: otherGroomerMembership.id,
      role: 'GROOMER',
      clinicalRole: null,
      userId: createdUsers[2]!.id,
    };
    receptionist = {
      organizationId,
      membershipId: receptionMembership.id,
      role: 'RECEPTION',
      clinicalRole: null,
      userId: createdUsers[3]!.id,
    };
    foreignOwner = {
      organizationId: foreignOrganizationId,
      membershipId: foreignMembership.id,
      role: 'OWNER',
      clinicalRole: null,
      userId: createdUsers[4]!.id,
    };

    const [location, foreignLocation] = await Promise.all([
      prisma.clinicLocation.create({
        data: { organizationId, name: 'Sede Grooming QA', status: 'ACTIVE' },
      }),
      prisma.clinicLocation.create({
        data: {
          organizationId: foreignOrganizationId,
          name: 'Sede extranjera QA',
          status: 'ACTIVE',
        },
      }),
    ]);
    locationId = location.id;
    foreignLocationId = foreignLocation.id;
    locations.push(locationId, foreignLocationId);
    const [ownerRecord, foreignOwnerRecord] = await Promise.all([
      prisma.owner.create({ data: { organizationId, firstName: 'Camila', lastName: 'Rojas' } }),
      prisma.owner.create({
        data: { organizationId: foreignOrganizationId, firstName: 'Valentina', lastName: 'Mora' },
      }),
    ]);
    ownerId = ownerRecord.id;
    owners.push(ownerId, foreignOwnerRecord.id);
    const [patient, foreignPatient] = await Promise.all([
      prisma.patient.create({
        data: {
          organizationId,
          ownerId,
          name: 'Luna',
          nameNormalized: `luna ${suffix}`,
          species: 'DOG',
        },
      }),
      prisma.patient.create({
        data: {
          organizationId: foreignOrganizationId,
          ownerId: foreignOwnerRecord.id,
          name: 'Nala',
          nameNormalized: `nala ${suffix}`,
          species: 'CAT',
        },
      }),
    ]);
    patientId = patient.id;
    foreignPatientId = foreignPatient.id;
    patientsIds.push(patientId, foreignPatientId);
    appointmentId = await makeAppointment();
    cancelledAppointmentId = await makeAppointment('CANCELLED');
  });

  afterAll(async () => {
    if (!prisma) return;
    if (organizations.length)
      await prisma.operationalAuditEvent.deleteMany({
        where: { organizationId: { in: organizations } },
      });
    if (visits.length) await prisma.groomingVisit.deleteMany({ where: { id: { in: visits } } });
    if (appointments.length)
      await prisma.appointment.deleteMany({ where: { id: { in: appointments } } });
    if (patientsIds.length) await prisma.patient.deleteMany({ where: { id: { in: patientsIds } } });
    if (owners.length) await prisma.owner.deleteMany({ where: { id: { in: owners } } });
    if (locations.length)
      await prisma.clinicLocation.deleteMany({ where: { id: { in: locations } } });
    if (memberships.length)
      await prisma.membership.deleteMany({ where: { id: { in: memberships } } });
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (organizations.length)
      await prisma.organization.deleteMany({ where: { id: { in: organizations } } });
    await prisma.$disconnect();
  });

  it('captures the Patient owner, separates this record from clinical history, and restricts assignment options', async () => {
    const draft = await createDraft(receptionist, { appointmentId });
    expect(draft.status).toBe('DRAFT');
    expect(draft.ownerIdAtTime).toBe(ownerId);
    expect(draft.patient.name).toBe('Luna');
    expect(draft.appointment?.id).toBe(appointmentId);
    expect(
      await prisma.operationalAuditEvent.count({
        where: { groomingVisitId: draft.id, action: 'GROOMING_CREATED' },
      }),
    ).toBe(1);
    expect(await prisma.clinicalAuditEvent.count({ where: { entityId: draft.id } })).toBe(0);
    expect((await grooming.groomers(organizationId)).data.map((member) => member.id)).toContain(
      groomer.membershipId,
    );
    expect(
      (await grooming.groomers(organizationId)).data.every((member) => !('email' in member)),
    ).toBe(true);
  });

  it('requires service and an active eligible Groomer before start; stale writes return 409', async () => {
    const noAssignment = await createDraft(owner, { assignedGroomerMembershipId: null });
    await expect(
      grooming.start(groomer, noAssignment.id, noAssignment.version),
    ).rejects.toMatchObject({ response: { code: 'GROOMER_REQUIRED' } });
    const noService = await createDraft(owner, { serviceSummary: null });
    await expect(grooming.start(groomer, noService.id, noService.version)).rejects.toMatchObject({
      response: { code: 'GROOMING_SERVICE_REQUIRED' },
    });
    const draft = await createDraft();
    const started = await grooming.start(groomer, draft.id, draft.version);
    expect(started.status).toBe('IN_PROGRESS');
    expect(started.version).toBe(draft.version + 1);
    expect(started.ownerDisplayNameSnapshot).toBe('Camila Rojas');
    expect(started.groomerDisplayNameSnapshot).toBe('Peluquero/a');
    await expect(
      grooming.update(owner, draft.id, {
        expectedVersion: draft.version,
        serviceSummary: 'Conflicto',
      }),
    ).rejects.toMatchObject({ response: { code: 'STALE_GROOMING_VISIT' } });
  });

  it('serializes start against Patient archive and rejects archiving an active Grooming visit', async () => {
    const archiveOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Archivo', lastName: `QA ${suffix}` },
    });
    owners.push(archiveOwner.id);
    const archivePatient = await prisma.patient.create({
      data: {
        organizationId,
        ownerId: archiveOwner.id,
        name: 'Archivo QA',
        nameNormalized: `archivo qa ${suffix}`,
        species: 'DOG',
      },
    });
    patientsIds.push(archivePatient.id);
    const draft = await createDraft(owner, {}, archivePatient.id);
    const started = await grooming.start(groomer, draft.id, draft.version);
    await expect(
      patients.archiveForOrganization(organizationId, archivePatient.id),
    ).rejects.toMatchObject({ response: { code: 'ACTIVE_GROOMING_VISIT_EXISTS' } });
    const completed = await grooming.complete(groomer, started.id, {
      expectedVersion: started.version,
      postServiceNotes: 'Resultado ficticio de QA',
    });
    expect(completed.status).toBe('COMPLETED');
    const archived = await patients.archiveForOrganization(organizationId, archivePatient.id);
    expect(archived.status).toBe('ARCHIVED');
    await expect(
      grooming.create(owner, archivePatient.id, { clinicLocationId: locationId }),
    ).rejects.toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
  });

  it('serializes Patient archive against Grooming completion', async () => {
    const archiveOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Carrera', lastName: `QA ${suffix}` },
    });
    owners.push(archiveOwner.id);
    const archivePatient = await prisma.patient.create({
      data: {
        organizationId,
        ownerId: archiveOwner.id,
        name: 'Paciente Carrera',
        nameNormalized: `paciente carrera ${suffix}`,
        species: 'DOG',
      },
    });
    patientsIds.push(archivePatient.id);
    const draft = await createDraft(owner, {}, archivePatient.id);
    const started = await grooming.start(groomer, draft.id, draft.version);
    const [completion] = await Promise.allSettled([
      grooming.complete(groomer, started.id, { expectedVersion: started.version }),
      patients.archiveForOrganization(organizationId, archivePatient.id),
    ]);
    const finalVisit = await grooming.findOne(owner, draft.id);
    const finalPatient = await prisma.patient.findFirstOrThrow({
      where: { id: archivePatient.id },
    });

    expect(completion.status).toBe('fulfilled');
    expect(finalVisit.status).toBe('COMPLETED');
    expect(finalPatient.status).toBe('ACTIVE');
  });

  it('blocks cancelled appointments, enforces one Grooming visit per appointment and hides cross-tenant IDs', async () => {
    await expect(
      grooming.create(owner, patientId, {
        clinicLocationId: locationId,
        appointmentId: cancelledAppointmentId,
      }),
    ).rejects.toMatchObject({ response: { code: 'APPOINTMENT_NOT_ELIGIBLE' } });
    const occupiedAppointmentId = await makeAppointment();
    const draft = await createDraft(owner, { appointmentId: occupiedAppointmentId });
    await expect(
      grooming.create(owner, patientId, {
        clinicLocationId: locationId,
        appointmentId: occupiedAppointmentId,
      }),
    ).rejects.toMatchObject({ response: { code: 'APPOINTMENT_ALREADY_HAS_GROOMING_VISIT' } });
    await expect(grooming.findOne(foreignOwner, draft.id)).rejects.toMatchObject({
      response: { code: 'GROOMING_VISIT_NOT_FOUND' },
    });
    await expect(
      grooming.listByPatient(owner, foreignPatientId, { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ response: { code: 'PATIENT_NOT_FOUND' } });
  });

  it('allows drafts to unlink cancelled or no-show appointments but does not start them', async () => {
    for (const terminalStatus of ['CANCELLED', 'NO_SHOW'] as const) {
      const lateAppointment = await makeAppointment();
      const draft = await createDraft(owner, { appointmentId: lateAppointment });
      if (terminalStatus === 'CANCELLED') {
        await agenda.cancel(owner, lateAppointment, { cancellationReason: 'Conflicto QA' });
      } else {
        await agenda.transition(organizationId, lateAppointment, AppointmentStatus.NO_SHOW);
      }
      const edited = await grooming.update(owner, draft.id, {
        expectedVersion: draft.version,
        serviceSummary: 'Actualización de borrador',
      });
      expect(edited.appointmentId).toBe(lateAppointment);
      await expect(grooming.start(groomer, edited.id, edited.version)).rejects.toMatchObject({
        response: { code: 'APPOINTMENT_NOT_ELIGIBLE' },
      });
      const unlinked = await grooming.update(owner, edited.id, {
        expectedVersion: edited.version,
        appointmentId: null,
      });
      expect(unlinked.appointmentId).toBeNull();
    }
  });

  it('allows exactly one concurrent start and supports completion then auditable void', async () => {
    const draft = await createDraft();
    const results = await Promise.allSettled([
      grooming.start(groomer, draft.id, draft.version),
      grooming.start(groomer, draft.id, draft.version),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const started = await grooming.findOne(owner, draft.id);
    const completed = await grooming.complete(groomer, started.id, {
      expectedVersion: started.version,
    });
    const voided = await grooming.void(owner, completed.id, {
      expectedVersion: completed.version,
      reason: 'Corrección QA ficticia',
    });
    expect(voided.status).toBe('VOIDED');
    expect(voided.voidReason).toBe('Corrección QA ficticia');
    expect(
      await prisma.operationalAuditEvent.count({ where: { groomingVisitId: draft.id } }),
    ).toBeGreaterThanOrEqual(4);
  });

  it('uses effective permissions instead of requiring the actor to be the assigned Groomer', async () => {
    const draft = await createDraft();
    const started = await grooming.start(otherGroomer, draft.id, draft.version);
    expect(started.startedByMembershipId).toBe(otherGroomer.membershipId);
    expect(started.assignedGroomerMembershipId).toBe(groomer.membershipId);

    const completed = await grooming.complete(otherGroomer, started.id, {
      expectedVersion: started.version,
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedByMembershipId).toBe(otherGroomer.membershipId);
  });

  it('serializes Agenda cancellation and no-show against Grooming start', async () => {
    for (const terminalStatus of ['CANCELLED', 'NO_SHOW'] as const) {
      const appointment = await makeAppointment();
      const draft = await createDraft(owner, { appointmentId: appointment });
      const results = await Promise.allSettled([
        grooming.start(groomer, draft.id, draft.version),
        terminalStatus === 'CANCELLED'
          ? agenda.cancel(owner, appointment, { cancellationReason: 'Conflicto QA' })
          : agenda.transition(organizationId, appointment, AppointmentStatus.NO_SHOW),
      ]);
      const [finalAppointment, finalVisit] = await Promise.all([
        prisma.appointment.findFirstOrThrow({ where: { id: appointment } }),
        grooming.findOne(owner, draft.id),
      ]);
      expect(finalAppointment.status).toBe(terminalStatus);
      if (finalVisit.status === 'IN_PROGRESS') {
        // Start held the shared Appointment lock first, so Agenda transitioned afterward.
        expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
      } else {
        // Agenda won first; start observed a terminal Appointment and rolled back.
        expect(finalVisit.status).toBe('DRAFT');
        expect(results[0].status).toBe('rejected');
        expect(results[1].status).toBe('fulfilled');
      }
    }
  });

  it('uses version CAS to serialize draft edits against start', async () => {
    const draft = await createDraft();
    const results = await Promise.allSettled([
      grooming.update(owner, draft.id, {
        expectedVersion: draft.version,
        serviceSummary: 'Cambio de servicio concurrente',
      }),
      grooming.start(groomer, draft.id, draft.version),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const finalVisit = await grooming.findOne(owner, draft.id);
    expect(finalVisit.version).toBe(draft.version + 1);
    expect(['DRAFT', 'IN_PROGRESS']).toContain(finalVisit.status);
  });

  it('serializes active edits against completion and rejects stale lifecycle writes', async () => {
    const draft = await createDraft();
    const started = await grooming.start(groomer, draft.id, draft.version);
    const results = await Promise.allSettled([
      grooming.update(groomer, started.id, {
        expectedVersion: started.version,
        incidentNotes: 'Incidente concurrente QA',
      }),
      grooming.complete(groomer, started.id, { expectedVersion: started.version }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const finalVisit = await grooming.findOne(owner, draft.id);
    expect(finalVisit.version).toBe(started.version + 1);
    expect(['IN_PROGRESS', 'COMPLETED']).toContain(finalVisit.status);
  });

  it('serializes duplicate completion, completion versus void, and duplicate void', async () => {
    const completionDraft = await createDraft();
    const completionStarted = await grooming.start(
      groomer,
      completionDraft.id,
      completionDraft.version,
    );
    const duplicateCompletion = await Promise.allSettled([
      grooming.complete(groomer, completionDraft.id, {
        expectedVersion: completionStarted.version,
      }),
      grooming.complete(groomer, completionDraft.id, {
        expectedVersion: completionStarted.version,
      }),
    ]);
    expect(duplicateCompletion.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(duplicateCompletion.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const competeDraft = await createDraft();
    const competeStarted = await grooming.start(groomer, competeDraft.id, competeDraft.version);
    const completionVsVoid = await Promise.allSettled([
      grooming.complete(groomer, competeDraft.id, { expectedVersion: competeStarted.version }),
      grooming.void(owner, competeDraft.id, {
        expectedVersion: competeStarted.version,
        reason: 'Anulación concurrente QA',
      }),
    ]);
    expect(completionVsVoid.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(completionVsVoid.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const voidDraft = await createDraft();
    const voidStarted = await grooming.start(groomer, voidDraft.id, voidDraft.version);
    const voidResults = await Promise.allSettled([
      grooming.void(owner, voidDraft.id, {
        expectedVersion: voidStarted.version,
        reason: 'Primera anulación QA',
      }),
      grooming.void(owner, voidDraft.id, {
        expectedVersion: voidStarted.version,
        reason: 'Segunda anulación QA',
      }),
    ]);
    expect(voidResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(voidResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await grooming.findOne(owner, voidDraft.id)).status).toBe('VOIDED');
  });

  it('rejects archived Patient completion and keeps immutable visit references', async () => {
    const isolatedOwner = await prisma.owner.create({
      data: { organizationId, firstName: 'Archivado', lastName: 'QA' },
    });
    owners.push(isolatedOwner.id);
    const isolatedPatient = await prisma.patient.create({
      data: {
        organizationId,
        ownerId: isolatedOwner.id,
        name: 'Paciente archivado QA',
        nameNormalized: `paciente archivado ${suffix}`,
        species: 'DOG',
      },
    });
    patientsIds.push(isolatedPatient.id);
    const draft = await createDraft(owner, {}, isolatedPatient.id);
    const started = await grooming.start(groomer, draft.id, draft.version);
    await prisma.patient.update({
      where: { id: isolatedPatient.id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await expect(
      grooming.complete(groomer, started.id, { expectedVersion: started.version }),
    ).rejects.toMatchObject({ response: { code: 'PATIENT_ARCHIVED' } });
  });
});
