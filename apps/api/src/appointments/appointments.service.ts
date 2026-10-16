import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  ClinicLocationStatus,
  MembershipStatus,
  OrganizationStatus,
  OwnerStatus,
  PatientStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  AppointmentListQueryDto,
  AvailabilityRuleDto,
  AvailableSlotsQueryDto,
  CancelAppointmentDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
  UpdateAppointmentDto,
  UpdateAvailabilityRuleDto,
} from './appointment.dto';

const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.WAITING_ROOM,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

const TERMINAL_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

const appointmentSelect = {
  id: true,
  organizationId: true,
  clinicLocationId: true,
  patientId: true,
  ownerId: true,
  assignedMembershipId: true,
  createdByMembershipId: true,
  status: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  notes: true,
  observations: true,
  ownerConfirmedAt: true,
  clinicConfirmedAt: true,
  cancelledAt: true,
  cancelledByMembershipId: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  patient: { select: { id: true, name: true, status: true } },
  owner: { select: { id: true, firstName: true, lastName: true, status: true } },
  clinicLocation: { select: { id: true, name: true, status: true, address: true, city: true } },
  assignedMembership: {
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { email: true } },
    },
  },
} satisfies Prisma.AppointmentSelect;

const availabilitySelect = {
  id: true,
  organizationId: true,
  clinicLocationId: true,
  membershipId: true,
  dayOfWeek: true,
  startLocalTime: true,
  endLocalTime: true,
  slotMinutes: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AvailabilityRuleSelect;

const availabilityListSelect = {
  ...availabilitySelect,
  membership: {
    select: {
      id: true,
      organizationId: true,
      role: true,
      user: { select: { email: true } },
    },
  },
} satisfies Prisma.AvailabilityRuleSelect;

type AppointmentRecord = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>;
type AvailabilityRecord = Prisma.AvailabilityRuleGetPayload<{ select: typeof availabilitySelect }>;
type DomainDatabase = PrismaService | Prisma.TransactionClient;

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

function validation(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

function conflict(message: string, code = 'APPOINTMENT_CONFLICT'): ConflictException {
  return new ConflictException({ code, message });
}

function trimNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseInstant(value: string): DateTime {
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    throw validation('Timestamps must include an explicit timezone offset or Z');
  }
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) throw validation(`Invalid timestamp: ${value}`);
  return parsed.toUTC();
}

function ensureInterval(startsAt: DateTime, endsAt: DateTime): void {
  if (endsAt.toMillis() <= startsAt.toMillis()) {
    throw validation('endsAt must be after startsAt');
  }
}

function parseLocalDateTime(date: string, time: string, timezone: string): DateTime {
  const parsed = DateTime.fromISO(`${date}T${time}`, { zone: timezone, setZone: true });
  if (!parsed.isValid) throw validation(`Invalid local time for timezone ${timezone}`);
  if (
    parsed.toFormat('yyyy-MM-dd') !== date ||
    parsed.toFormat('HH:mm') !== time ||
    parsed.getPossibleOffsets().length !== 1
  ) {
    throw validation(`Local time ${date} ${time} is ambiguous or invalid in ${timezone}`);
  }
  return parsed.toUTC();
}

function minutesOfDay(dateTime: DateTime): number {
  return dateTime.hour * 60 + dateTime.minute;
}

function dayOfWeek(dateTime: DateTime): number {
  return dateTime.weekday % 7;
}

function isTerminal(status: AppointmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function assertReason(value: string): string {
  const reason = value.trim();
  if (!reason) throw validation('reason is required');
  return reason;
}

// AppointmentService owns all agenda invariants, transitions and conflict handling.
@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: AppointmentListQueryDto) {
    const from = parseInstant(query.from);
    const to = parseInstant(query.to);
    this.assertRange(from, to);
    return this.prisma.appointment.findMany({
      where: {
        organizationId,
        startsAt: { lt: to.toJSDate() },
        endsAt: { gt: from.toJSDate() },
        ...(query.clinicLocationId ? { clinicLocationId: query.clinicLocationId } : {}),
        ...(query.assignedMembershipId ? { assignedMembershipId: query.assignedMembershipId } : {}),
        ...(query.patientId ? { patientId: query.patientId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { startsAt: 'asc' },
      select: appointmentSelect,
    });
  }

  async findById(organizationId: string, appointmentId: string): Promise<AppointmentRecord> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId },
      select: appointmentSelect,
    });
    if (!appointment) throw notFound();
    return appointment;
  }

  async create(
    tenant: { organizationId: string; membershipId: string },
    input: CreateAppointmentDto,
  ) {
    const startsAt = parseInstant(input.startsAt);
    const endsAt = parseInstant(input.endsAt);
    ensureInterval(startsAt, endsAt);
    const reason = assertReason(input.reason);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.lockActiveLocation(tx, tenant.organizationId, input.clinicLocationId);
        await this.validateReferences(tx, tenant.organizationId, input, tenant.membershipId);
        const organization = await this.requireOrganization(tx, tenant.organizationId);
        await this.validateAvailability(tx, organization.timezone, tenant.organizationId, {
          clinicLocationId: input.clinicLocationId,
          assignedMembershipId: input.assignedMembershipId ?? null,
          startsAt,
          endsAt,
        });
        await this.assertNoConflict(tx, tenant.organizationId, {
          patientId: input.patientId,
          assignedMembershipId: input.assignedMembershipId ?? null,
          startsAt,
          endsAt,
        });
        return tx.appointment.create({
          data: {
            organizationId: tenant.organizationId,
            clinicLocationId: input.clinicLocationId,
            patientId: input.patientId,
            ownerId: input.ownerId,
            assignedMembershipId: input.assignedMembershipId ?? null,
            createdByMembershipId: tenant.membershipId,
            status: AppointmentStatus.SCHEDULED,
            startsAt: startsAt.toJSDate(),
            endsAt: endsAt.toJSDate(),
            reason,
            notes: trimNullable(input.notes) ?? null,
          },
          select: { id: true },
        });
      });
      return this.findById(tenant.organizationId, created.id);
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
  }

  async update(
    tenant: { organizationId: string },
    appointmentId: string,
    input: UpdateAppointmentDto,
  ) {
    const current = await this.requireMutable(tenant.organizationId, appointmentId);
    if (input.assignedMembershipId !== undefined) {
      if (input.assignedMembershipId !== null) {
        await this.requireActiveMembership(
          this.prisma,
          tenant.organizationId,
          input.assignedMembershipId,
        );
      }
      const organization = await this.requireOrganization(this.prisma, tenant.organizationId);
      await this.assertNoConflict(this.prisma, tenant.organizationId, {
        patientId: current.patientId,
        assignedMembershipId: input.assignedMembershipId,
        startsAt: DateTime.fromJSDate(current.startsAt).toUTC(),
        endsAt: DateTime.fromJSDate(current.endsAt).toUTC(),
        excludeAppointmentId: appointmentId,
      });
      await this.validateAvailability(this.prisma, organization.timezone, tenant.organizationId, {
        clinicLocationId: current.clinicLocationId,
        assignedMembershipId: input.assignedMembershipId,
        startsAt: DateTime.fromJSDate(current.startsAt).toUTC(),
        endsAt: DateTime.fromJSDate(current.endsAt).toUTC(),
      });
    }
    try {
      // The status predicate makes a stale edit fail instead of mutating a row that
      // another operator moved to a terminal or in-progress state meanwhile.
      const result = await this.prisma.appointment.updateMany({
        where: {
          id: appointmentId,
          organizationId: tenant.organizationId,
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING_ROOM] },
        },
        data: {
          ...(input.reason === undefined ? {} : { reason: assertReason(input.reason) }),
          ...(input.notes === undefined ? {} : { notes: trimNullable(input.notes) ?? null }),
          ...(input.assignedMembershipId === undefined
            ? {}
            : { assignedMembershipId: input.assignedMembershipId }),
        },
      });
      if (result.count !== 1) {
        throw conflict(
          'Appointment changed before the edit was saved',
          'INVALID_APPOINTMENT_STATE',
        );
      }
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
    return this.findById(tenant.organizationId, appointmentId);
  }

  async reschedule(
    tenant: { organizationId: string },
    appointmentId: string,
    input: RescheduleAppointmentDto,
  ) {
    const current = await this.requireMutable(tenant.organizationId, appointmentId);
    if (current.status !== AppointmentStatus.SCHEDULED) {
      throw conflict('Only scheduled appointments can be rescheduled', 'INVALID_APPOINTMENT_STATE');
    }
    const startsAt = parseInstant(input.startsAt);
    const endsAt = parseInstant(input.endsAt);
    ensureInterval(startsAt, endsAt);
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.lockActiveLocation(tx, tenant.organizationId, current.clinicLocationId);
        await this.validateExistingReferences(tx, tenant.organizationId, current);
        const organization = await this.requireOrganization(tx, tenant.organizationId);
        await this.validateAvailability(tx, organization.timezone, tenant.organizationId, {
          clinicLocationId: current.clinicLocationId,
          assignedMembershipId: current.assignedMembershipId,
          startsAt,
          endsAt,
        });
        await this.assertNoConflict(tx, tenant.organizationId, {
          patientId: current.patientId,
          assignedMembershipId: current.assignedMembershipId,
          startsAt,
          endsAt,
          excludeAppointmentId: appointmentId,
        });
        const result = await tx.appointment.updateMany({
          where: {
            id: appointmentId,
            organizationId: tenant.organizationId,
            status: AppointmentStatus.SCHEDULED,
          },
          data: { startsAt: startsAt.toJSDate(), endsAt: endsAt.toJSDate() },
        });
        if (result.count !== 1) {
          throw conflict(
            'Appointment changed before rescheduling was saved',
            'INVALID_APPOINTMENT_STATE',
          );
        }
      });
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
    return this.findById(tenant.organizationId, appointmentId);
  }

  async cancel(
    tenant: { organizationId: string; membershipId: string },
    appointmentId: string,
    input: CancelAppointmentDto,
  ) {
    const current = await this.findById(tenant.organizationId, appointmentId);
    if (
      !(
        [AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING_ROOM] as AppointmentStatus[]
      ).includes(current.status)
    ) {
      throw conflict(
        'Appointment cannot be cancelled from its current state',
        'INVALID_APPOINTMENT_STATE',
      );
    }
    // Conditional update closes the double-cancel race: exactly one request can
    // transition SCHEDULED/WAITING_ROOM to CANCELLED.
    const result = await this.prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        organizationId: tenant.organizationId,
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING_ROOM] },
      },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByMembershipId: tenant.membershipId,
        cancellationReason: trimNullable(input.cancellationReason) ?? null,
      },
    });
    if (result.count !== 1) {
      throw conflict(
        'Appointment changed before cancellation was confirmed',
        'INVALID_APPOINTMENT_STATE',
      );
    }
    return this.findById(tenant.organizationId, appointmentId);
  }

  async transition(
    organizationId: string,
    appointmentId: string,
    target: AppointmentStatus,
  ): Promise<AppointmentRecord> {
    const current = await this.findById(organizationId, appointmentId);
    if (!this.isAllowedTransition(current.status, target)) {
      throw conflict(
        `Transition ${current.status} -> ${target} is not allowed`,
        'INVALID_APPOINTMENT_TRANSITION',
      );
    }
    // Compare-and-set prevents two operators from applying the same transition
    // after both observed the same previous status.
    const result = await this.prisma.$transaction(async (tx) => {
      if (target === AppointmentStatus.WAITING_ROOM || target === AppointmentStatus.IN_PROGRESS) {
        await this.lockActiveLocation(tx, organizationId, current.clinicLocationId);
      }
      return tx.appointment.updateMany({
        where: { id: appointmentId, organizationId, status: current.status },
        data: { status: target },
      });
    });
    if (result.count !== 1) {
      throw conflict(
        'Appointment changed before the transition was saved',
        'INVALID_APPOINTMENT_STATE',
      );
    }
    return this.findById(organizationId, appointmentId);
  }

  async confirm(organizationId: string, appointmentId: string, kind: 'owner' | 'clinic') {
    const current = await this.findById(organizationId, appointmentId);
    if (isTerminal(current.status))
      throw conflict('Terminal appointments cannot be confirmed', 'INVALID_APPOINTMENT_STATE');
    // Confirmation is independent metadata, but it must never be written after
    // a concurrent terminal transition has won the race.
    const result = await this.prisma.appointment.updateMany({
      where: {
        id: appointmentId,
        organizationId,
        status: { notIn: TERMINAL_STATUSES },
      },
      data: kind === 'owner' ? { ownerConfirmedAt: new Date() } : { clinicConfirmedAt: new Date() },
    });
    if (result.count !== 1) {
      throw conflict('Terminal appointments cannot be confirmed', 'INVALID_APPOINTMENT_STATE');
    }
    return this.findById(organizationId, appointmentId);
  }

  listAvailability(organizationId: string) {
    return this.prisma.availabilityRule.findMany({
      where: { organizationId },
      orderBy: [{ clinicLocationId: 'asc' }, { dayOfWeek: 'asc' }, { startLocalTime: 'asc' }],
      select: availabilityListSelect,
    });
  }

  async createAvailability(organizationId: string, input: AvailabilityRuleDto) {
    this.validateRuleTimes(input.startLocalTime, input.endLocalTime);
    await this.validateAvailabilityReferences(
      this.prisma,
      organizationId,
      input.clinicLocationId,
      input.membershipId ?? null,
    );
    await this.assertNoAvailabilityOverlap(this.prisma, organizationId, {
      clinicLocationId: input.clinicLocationId,
      membershipId: input.membershipId ?? null,
      dayOfWeek: input.dayOfWeek,
      startLocalTime: input.startLocalTime,
      endLocalTime: input.endLocalTime,
    });
    const rule = await this.prisma.availabilityRule.create({
      data: {
        organizationId,
        clinicLocationId: input.clinicLocationId,
        membershipId: input.membershipId ?? null,
        dayOfWeek: input.dayOfWeek,
        startLocalTime: input.startLocalTime,
        endLocalTime: input.endLocalTime,
        slotMinutes: input.slotMinutes,
        notes: trimNullable(input.notes) ?? null,
      },
      select: availabilityListSelect,
    });
    return rule;
  }

  async updateAvailability(
    organizationId: string,
    ruleId: string,
    input: UpdateAvailabilityRuleDto,
  ) {
    const current = await this.prisma.availabilityRule.findFirst({
      where: { id: ruleId, organizationId },
    });
    if (!current) throw notFound();
    const start = input.startLocalTime ?? current.startLocalTime;
    const end = input.endLocalTime ?? current.endLocalTime;
    this.validateRuleTimes(start, end);
    const locationId = input.clinicLocationId ?? current.clinicLocationId;
    const membershipId =
      input.membershipId === undefined ? current.membershipId : input.membershipId;
    await this.validateAvailabilityReferences(
      this.prisma,
      organizationId,
      locationId,
      membershipId,
    );
    if (input.isActive ?? current.isActive) {
      await this.assertNoAvailabilityOverlap(this.prisma, organizationId, {
        clinicLocationId: locationId,
        membershipId,
        dayOfWeek: input.dayOfWeek ?? current.dayOfWeek,
        startLocalTime: start,
        endLocalTime: end,
        excludeRuleId: ruleId,
      });
    }
    return this.prisma.availabilityRule.update({
      where: { id: ruleId },
      data: {
        ...(input.clinicLocationId === undefined
          ? {}
          : { clinicLocationId: input.clinicLocationId }),
        ...(input.membershipId === undefined ? {} : { membershipId: input.membershipId }),
        ...(input.dayOfWeek === undefined ? {} : { dayOfWeek: input.dayOfWeek }),
        ...(input.startLocalTime === undefined ? {} : { startLocalTime: input.startLocalTime }),
        ...(input.endLocalTime === undefined ? {} : { endLocalTime: input.endLocalTime }),
        ...(input.slotMinutes === undefined ? {} : { slotMinutes: input.slotMinutes }),
        ...(input.notes === undefined ? {} : { notes: trimNullable(input.notes) ?? null }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
      select: availabilityListSelect,
    });
  }

  async deactivateAvailability(organizationId: string, ruleId: string) {
    const result = await this.prisma.availabilityRule.updateMany({
      where: { id: ruleId, organizationId },
      data: { isActive: false },
    });
    if (result.count !== 1) throw notFound();
    return this.prisma.availabilityRule.findUniqueOrThrow({
      where: { id: ruleId },
      select: availabilityListSelect,
    });
  }

  async availableSlots(organizationId: string, query: AvailableSlotsQueryDto) {
    const organization = await this.requireOrganization(this.prisma, organizationId);
    await this.requireActiveLocation(this.prisma, organizationId, query.clinicLocationId);
    if (query.assignedMembershipId)
      await this.requireActiveMembership(this.prisma, organizationId, query.assignedMembershipId);
    const date = DateTime.fromISO(query.date, { zone: organization.timezone });
    if (!date.isValid || date.toFormat('yyyy-MM-dd') !== query.date)
      throw validation('date is invalid');
    const rules = await this.selectApplicableRules(
      this.prisma,
      organizationId,
      query.clinicLocationId,
      query.assignedMembershipId ?? null,
      dayOfWeek(date),
    );
    if (!rules.length)
      return {
        mode: 'UNRESTRICTED' as const,
        timezone: organization.timezone,
        date: query.date,
        slots: [],
      };
    const slots: Array<{ startsAt: string; endsAt: string }> = [];
    for (const rule of rules) {
      let cursor = parseLocalDateTime(query.date, rule.startLocalTime, organization.timezone);
      const end = parseLocalDateTime(query.date, rule.endLocalTime, organization.timezone);
      while (cursor.plus({ minutes: query.durationMinutes }).toMillis() <= end.toMillis()) {
        const slotEnd = cursor.plus({ minutes: query.durationMinutes });
        const conflictExists = await this.hasBlockingConflict(this.prisma, organizationId, {
          patientId: null,
          assignedMembershipId: query.assignedMembershipId ?? null,
          startsAt: cursor,
          endsAt: slotEnd,
        });
        if (!conflictExists) slots.push({ startsAt: cursor.toISO()!, endsAt: slotEnd.toISO()! });
        cursor = cursor.plus({ minutes: rule.slotMinutes });
      }
    }
    return { mode: 'RULES' as const, timezone: organization.timezone, date: query.date, slots };
  }

  private async requireMutable(
    organizationId: string,
    appointmentId: string,
  ): Promise<AppointmentRecord> {
    const current = await this.findById(organizationId, appointmentId);
    if (isTerminal(current.status) || current.status === AppointmentStatus.IN_PROGRESS) {
      throw conflict(
        'Appointment is not editable in its current state',
        'INVALID_APPOINTMENT_STATE',
      );
    }
    return current;
  }

  private isAllowedTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
    return (
      (from === AppointmentStatus.SCHEDULED &&
        (
          [
            AppointmentStatus.WAITING_ROOM,
            AppointmentStatus.IN_PROGRESS,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.NO_SHOW,
          ] as AppointmentStatus[]
        ).includes(to)) ||
      (from === AppointmentStatus.WAITING_ROOM &&
        (
          [
            AppointmentStatus.IN_PROGRESS,
            AppointmentStatus.CANCELLED,
            AppointmentStatus.NO_SHOW,
          ] as AppointmentStatus[]
        ).includes(to)) ||
      (from === AppointmentStatus.IN_PROGRESS && to === AppointmentStatus.COMPLETED)
    );
  }

  private assertRange(from: DateTime, to: DateTime): void {
    ensureInterval(from, to);
    if (to.diff(from, 'days').days > 90)
      throw validation('Appointment range cannot exceed 90 days');
  }

  private async requireOrganization(database: DomainDatabase, organizationId: string) {
    const organization = await database.organization.findFirst({
      where: { id: organizationId, status: OrganizationStatus.ACTIVE },
      select: { id: true, timezone: true },
    });
    if (!organization) throw notFound();
    return organization;
  }

  private async requireActiveLocation(
    database: DomainDatabase,
    organizationId: string,
    locationId: string,
  ) {
    const location = await database.clinicLocation.findFirst({
      where: { id: locationId, organizationId, status: ClinicLocationStatus.ACTIVE },
      select: { id: true },
    });
    if (!location) throw notFound();
  }

  // Shared row locking prevents a create, reschedule or check-in from racing location deactivation.
  private async lockActiveLocation(
    database: DomainDatabase,
    organizationId: string,
    locationId: string,
  ) {
    await database.$queryRaw(
      Prisma.sql`SELECT id FROM clinic_locations WHERE id = ${locationId}::uuid AND organization_id = ${organizationId}::uuid FOR SHARE`,
    );
    await this.requireActiveLocation(database, organizationId, locationId);
  }

  private async requireActiveMembership(
    database: DomainDatabase,
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await database.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!membership) throw notFound();
  }

  private async validateReferences(
    database: DomainDatabase,
    organizationId: string,
    input: CreateAppointmentDto,
    createdByMembershipId: string,
  ) {
    await this.requireOrganization(database, organizationId);
    await this.requireActiveLocation(database, organizationId, input.clinicLocationId);
    const patient = await database.patient.findFirst({
      where: { id: input.patientId, organizationId, status: PatientStatus.ACTIVE },
      select: { id: true, ownerId: true },
    });
    if (!patient) throw notFound();
    const owner = await database.owner.findFirst({
      where: { id: input.ownerId, organizationId, status: OwnerStatus.ACTIVE },
      select: { id: true },
    });
    if (!owner) throw notFound();
    if (patient.ownerId !== input.ownerId)
      throw conflict('ownerId must match the current Patient owner', 'OWNER_PATIENT_MISMATCH');
    if (input.assignedMembershipId)
      await this.requireActiveMembership(database, organizationId, input.assignedMembershipId);
    await this.requireActiveMembership(database, organizationId, createdByMembershipId);
  }

  private async validateExistingReferences(
    database: DomainDatabase,
    organizationId: string,
    appointment: AppointmentRecord,
  ): Promise<void> {
    const patient = await database.patient.findFirst({
      where: { id: appointment.patientId, organizationId, status: PatientStatus.ACTIVE },
      select: { ownerId: true },
    });
    const owner = await database.owner.findFirst({
      where: { id: appointment.ownerId, organizationId, status: OwnerStatus.ACTIVE },
      select: { id: true },
    });
    if (!patient || !owner)
      throw conflict('Archived Patient or Owner cannot be rescheduled', 'RESOURCE_ARCHIVED');
    if (patient.ownerId !== appointment.ownerId) {
      throw conflict(
        'Appointment owner no longer matches the Patient owner',
        'OWNER_PATIENT_MISMATCH',
      );
    }
    await this.requireActiveLocation(database, organizationId, appointment.clinicLocationId);
    if (appointment.assignedMembershipId) {
      await this.requireActiveMembership(
        database,
        organizationId,
        appointment.assignedMembershipId,
      );
    }
  }

  private async validateAvailabilityReferences(
    database: DomainDatabase,
    organizationId: string,
    locationId: string,
    membershipId: string | null,
  ) {
    await this.requireActiveLocation(database, organizationId, locationId);
    if (membershipId) await this.requireActiveMembership(database, organizationId, membershipId);
  }

  private async validateAvailability(
    database: DomainDatabase,
    timezone: string,
    organizationId: string,
    input: {
      clinicLocationId: string;
      assignedMembershipId: string | null;
      startsAt: DateTime;
      endsAt: DateTime;
    },
  ) {
    const localStart = input.startsAt.setZone(timezone);
    const localEnd = input.endsAt.setZone(timezone);
    if (localStart.toFormat('yyyy-MM-dd') !== localEnd.toFormat('yyyy-MM-dd'))
      throw validation('Appointment cannot cross a local calendar day');
    const rules = await this.selectApplicableRules(
      database,
      organizationId,
      input.clinicLocationId,
      input.assignedMembershipId,
      dayOfWeek(localStart),
    );
    if (!rules.length) return;
    const startMinutes = minutesOfDay(localStart);
    const endMinutes = minutesOfDay(localEnd);
    const fits = rules.some((rule) => {
      const windowStart = this.timeToMinutes(rule.startLocalTime);
      const windowEnd = this.timeToMinutes(rule.endLocalTime);
      return (
        startMinutes >= windowStart &&
        endMinutes <= windowEnd &&
        (startMinutes - windowStart) % rule.slotMinutes === 0
      );
    });
    if (!fits)
      throw conflict(
        'Appointment is outside the applicable availability rule',
        'OUTSIDE_AVAILABILITY',
      );
  }

  private async selectApplicableRules(
    database: DomainDatabase,
    organizationId: string,
    locationId: string,
    membershipId: string | null,
    weekday: number,
  ): Promise<AvailabilityRecord[]> {
    const rules = await database.availabilityRule.findMany({
      where: {
        organizationId,
        clinicLocationId: locationId,
        dayOfWeek: weekday,
        isActive: true,
        OR: [{ membershipId: null }, ...(membershipId ? [{ membershipId }] : [])],
      },
      select: availabilitySelect,
      orderBy: { startLocalTime: 'asc' },
    });
    if (membershipId && rules.some((rule) => rule.membershipId === membershipId))
      return rules.filter((rule) => rule.membershipId === membershipId);
    return rules.filter((rule) => rule.membershipId === null);
  }

  private async assertNoConflict(
    database: DomainDatabase,
    organizationId: string,
    input: {
      patientId: string;
      assignedMembershipId: string | null;
      startsAt: DateTime;
      endsAt: DateTime;
      excludeAppointmentId?: string;
    },
  ) {
    if (await this.hasBlockingConflict(database, organizationId, input))
      throw conflict('Appointment overlaps an active appointment', 'APPOINTMENT_CONFLICT');
  }

  // Rules in the same location/day/scope must be disjoint. Membership-specific
  // and location-wide scopes may overlap because precedence makes them explicit.
  private async assertNoAvailabilityOverlap(
    database: DomainDatabase,
    organizationId: string,
    input: {
      clinicLocationId: string;
      membershipId: string | null;
      dayOfWeek: number;
      startLocalTime: string;
      endLocalTime: string;
      excludeRuleId?: string;
    },
  ): Promise<void> {
    const overlapping = await database.availabilityRule.findFirst({
      where: {
        organizationId,
        clinicLocationId: input.clinicLocationId,
        membershipId: input.membershipId,
        dayOfWeek: input.dayOfWeek,
        isActive: true,
        ...(input.excludeRuleId ? { id: { not: input.excludeRuleId } } : {}),
        startLocalTime: { lt: input.endLocalTime },
        endLocalTime: { gt: input.startLocalTime },
      },
      select: { id: true },
    });
    if (overlapping) {
      throw conflict(
        'Availability rules cannot overlap within the same scope',
        'AVAILABILITY_OVERLAP',
      );
    }
  }

  private async hasBlockingConflict(
    database: DomainDatabase,
    organizationId: string,
    input: {
      patientId: string | null;
      assignedMembershipId: string | null;
      startsAt: DateTime;
      endsAt: DateTime;
      excludeAppointmentId?: string;
    },
  ) {
    const resourceFilters: Prisma.AppointmentWhereInput[] = [];
    if (input.patientId) resourceFilters.push({ patientId: input.patientId });
    if (input.assignedMembershipId)
      resourceFilters.push({ assignedMembershipId: input.assignedMembershipId });
    if (!resourceFilters.length) return false;
    const conflictRecord = await database.appointment.findFirst({
      where: {
        organizationId,
        status: { in: BLOCKING_STATUSES },
        ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
        startsAt: { lt: input.endsAt.toJSDate() },
        endsAt: { gt: input.startsAt.toJSDate() },
        OR: resourceFilters,
      },
      select: { id: true },
    });
    return Boolean(conflictRecord);
  }

  private validateRuleTimes(start: string, end: string): void {
    if (this.timeToMinutes(end) <= this.timeToMinutes(start))
      throw validation('endLocalTime must be after startLocalTime');
  }

  private timeToMinutes(value: string): number {
    const [hoursText, minutesText] = value.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes))
      throw validation('Invalid local time');
    return hours * 60 + minutes;
  }

  private rethrowConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' || error.code === 'P2034')
        throw conflict('Appointment conflicts with another appointment');
      if (error.code === 'P2004' || error.code === 'P2010')
        throw conflict('Appointment conflicts with another appointment');
    }
    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      (/23P01/.test(error.message) || /exclusion constraint/i.test(error.message))
    ) {
      throw conflict('Appointment conflicts with another appointment');
    }
  }
}
