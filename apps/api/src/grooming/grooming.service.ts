import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  ClinicLocationStatus,
  GroomingVisitStatus,
  MembershipRole,
  MembershipStatus,
  PatientStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type {
  GroomingGroomerListResponse,
  GroomingVisit,
  GroomingVisitListResponse,
} from '@veterinary-saas/contracts';
import { hasPermissions } from '../authorization/permissions';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  CompleteGroomingVisitDto,
  CreateGroomingVisitDto,
  GroomingVisitListQueryDto,
  GroomingGroomerListQueryDto,
  UpdateGroomingVisitDto,
  VoidGroomingVisitDto,
} from './grooming.dto';

type Transaction = Prisma.TransactionClient;

// Every response relation is explicit; user contact details and audit metadata never leave the API.
const visitSelect = {
  id: true,
  organizationId: true,
  patientId: true,
  ownerIdAtTime: true,
  clinicLocationId: true,
  appointmentId: true,
  assignedGroomerMembershipId: true,
  createdByMembershipId: true,
  startedByMembershipId: true,
  completedByMembershipId: true,
  voidedByMembershipId: true,
  status: true,
  version: true,
  serviceSummary: true,
  coatCondition: true,
  skinObservations: true,
  temperamentNotes: true,
  preServiceNotes: true,
  postServiceNotes: true,
  incidentNotes: true,
  patientNameSnapshot: true,
  ownerDisplayNameSnapshot: true,
  groomerDisplayNameSnapshot: true,
  startedAt: true,
  completedAt: true,
  voidedAt: true,
  voidReason: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      name: true,
      species: true,
      status: true,
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  ownerAtTime: { select: { id: true, firstName: true, lastName: true } },
  clinicLocation: { select: { id: true, name: true, status: true } },
  appointment: { select: { id: true, status: true, startsAt: true, reason: true } },
  assignedGroomerMembership: {
    select: { id: true, role: true, professionalProfile: { select: { displayName: true } } },
  },
  createdByMembership: {
    select: { id: true, role: true, professionalProfile: { select: { displayName: true } } },
  },
  completedByMembership: {
    select: { id: true, role: true, professionalProfile: { select: { displayName: true } } },
  },
  voidedByMembership: {
    select: { id: true, role: true, professionalProfile: { select: { displayName: true } } },
  },
} as const satisfies Prisma.GroomingVisitSelect;

type VisitRecord = Prisma.GroomingVisitGetPayload<{ select: typeof visitSelect }>;
const terminalAppointmentStates: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

// Grooming owns its operational lifecycle and keeps every database operation tenant scoped.
@Injectable()
export class GroomingService {
  constructor(private readonly prisma: PrismaService) {}

  // The bounded operational queue puts active work first and then retains useful recent history.
  async list(
    tenant: TenantContext,
    query: GroomingVisitListQueryDto,
  ): Promise<GroomingVisitListResponse> {
    const where = this.buildWhere(tenant.organizationId, query);
    const [ids, total] = await Promise.all([
      this.queueIds(tenant.organizationId, query),
      this.prisma.groomingVisit.count({ where }),
    ]);
    return this.listFromIds(tenant, ids, query.page, query.pageSize, total);
  }

  // Patient history intentionally includes every state and uses newest-first ordering.
  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: GroomingVisitListQueryDto,
  ): Promise<GroomingVisitListResponse> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!patient) throw this.notFound('PATIENT_NOT_FOUND', 'Patient not found');
    const where = { ...this.buildWhere(tenant.organizationId, query), patientId };
    const [records, total] = await Promise.all([
      this.prisma.groomingVisit.findMany({
        where,
        select: visitSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.groomingVisit.count({ where }),
    ]);
    return this.toList(tenant, records, query.page, query.pageSize, total);
  }

  // Groomer lookup returns only identity fields and never loads an unbounded membership list.
  async groomers(
    organizationId: string,
    query: GroomingGroomerListQueryDto = new GroomingGroomerListQueryDto(),
  ): Promise<GroomingGroomerListResponse> {
    const where: Prisma.MembershipWhereInput = {
      organizationId,
      status: MembershipStatus.ACTIVE,
      user: { status: UserStatus.ACTIVE },
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.GROOMER] },
      ...(query.search
        ? {
            professionalProfile: {
              displayName: { contains: query.search, mode: 'insensitive' },
            },
          }
        : {}),
    };
    const [memberships, total] = await Promise.all([
      this.prisma.membership.findMany({
        where,
        select: {
          id: true,
          role: true,
          professionalProfile: { select: { displayName: true } },
        },
        orderBy: [{ role: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.membership.count({ where }),
    ]);
    const data = memberships
      .filter((membership) => hasPermissions(membership.role, null, ['grooming.perform']))
      .map((membership) => ({
        id: membership.id,
        role: membership.role,
        displayName: this.memberName(membership.professionalProfile?.displayName, membership.role),
      }));
    return {
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  // A cross-tenant resource is indistinguishable from a missing resource.
  async findOne(tenant: TenantContext, groomingVisitId: string): Promise<GroomingVisit> {
    const record = await this.prisma.groomingVisit.findFirst({
      where: { id: groomingVisitId, organizationId: tenant.organizationId },
      select: visitSelect,
    });
    if (!record) throw this.notFound('GROOMING_VISIT_NOT_FOUND', 'Grooming visit not found');
    return this.toResponse(tenant, record);
  }

  // Creation fixes the historical Owner from Patient.ownerId and serializes against archive.
  async create(
    tenant: TenantContext,
    patientId: string,
    input: CreateGroomingVisitDto,
  ): Promise<GroomingVisit> {
    const serviceSummary = this.trim(input.serviceSummary);
    const id = await this.withAppointmentConflict(() =>
      this.prisma.$transaction(async (tx) => {
        await this.lockPatient(tx, tenant.organizationId, patientId);
        const patient = await this.requireActivePatient(tx, tenant.organizationId, patientId);
        const appointmentId = input.appointmentId ?? null;
        await this.lockOptionalAppointment(tx, tenant.organizationId, appointmentId);
        await this.lockActiveLocation(tx, tenant.organizationId, input.clinicLocationId);
        if (appointmentId) {
          await this.requireAppointment(
            tx,
            tenant.organizationId,
            patientId,
            input.clinicLocationId,
            appointmentId,
            true,
          );
          const linked = await tx.groomingVisit.findFirst({
            where: { organizationId: tenant.organizationId, appointmentId },
            select: { id: true },
          });
          if (linked)
            throw this.conflict(
              'APPOINTMENT_ALREADY_HAS_GROOMING_VISIT',
              'Appointment already has a grooming visit',
            );
        }
        const assignedId = input.assignedGroomerMembershipId ?? null;
        await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId, assignedId]);
        await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);
        if (assignedId) await this.requirePerformer(tx, tenant.organizationId, assignedId);
        const created = await tx.groomingVisit.create({
          data: {
            organizationId: tenant.organizationId,
            patientId,
            ownerIdAtTime: patient.ownerId,
            clinicLocationId: input.clinicLocationId,
            appointmentId,
            assignedGroomerMembershipId: assignedId,
            createdByMembershipId: tenant.membershipId,
            serviceSummary: serviceSummary ?? null,
            coatCondition: this.trim(input.coatCondition) ?? null,
            skinObservations: this.trim(input.skinObservations) ?? null,
            temperamentNotes: this.trim(input.temperamentNotes) ?? null,
            preServiceNotes: this.trim(input.preServiceNotes) ?? null,
          },
          select: { id: true },
        });
        await this.audit(tx, tenant, created.id, 'GROOMING_CREATED', {
          status: 'DRAFT',
          version: 1,
        });
        return created.id;
      }),
    );
    return this.findOne(tenant, id);
  }

  // Drafts may change intake references; active visits may only change operational notes.
  async update(
    tenant: TenantContext,
    groomingVisitId: string,
    input: UpdateGroomingVisitDto,
  ): Promise<GroomingVisit> {
    const initial = await this.findMutationSnapshot(tenant.organizationId, groomingVisitId);
    const id = await this.withAppointmentConflict(() =>
      this.prisma.$transaction(async (tx) => {
        await this.lockPatient(tx, tenant.organizationId, initial.patientId);
        let current = await this.findMutationSnapshotTx(tx, tenant.organizationId, groomingVisitId);
        await this.lockOptionalAppointment(tx, tenant.organizationId, current.appointmentId);
        if (input.appointmentId && input.appointmentId !== current.appointmentId) {
          await this.lockOptionalAppointment(tx, tenant.organizationId, input.appointmentId);
        }
        await this.lockVisit(tx, tenant.organizationId, groomingVisitId);
        current = await this.findMutationSnapshotTx(tx, tenant.organizationId, groomingVisitId);
        if (current.version !== input.expectedVersion)
          throw this.staleVersion(input.expectedVersion, current.version);
        if (
          current.status !== GroomingVisitStatus.DRAFT &&
          current.status !== GroomingVisitStatus.IN_PROGRESS
        ) {
          throw this.stateConflict(
            'GROOMING_VISIT_NOT_EDITABLE',
            'Only draft or in-progress visits can be edited',
          );
        }
        await this.requireActivePatient(tx, tenant.organizationId, current.patientId);

        const active = current.status === GroomingVisitStatus.IN_PROGRESS;
        const allowedActiveFields = [
          'serviceSummary',
          'coatCondition',
          'skinObservations',
          'temperamentNotes',
          'preServiceNotes',
          'postServiceNotes',
          'incidentNotes',
        ];
        if (
          active &&
          Object.keys(input).some(
            (key) => key !== 'expectedVersion' && !allowedActiveFields.includes(key),
          )
        ) {
          throw this.stateConflict(
            'GROOMING_VISIT_FIELDS_LOCKED',
            'Patient, location, appointment and groomer cannot change after service starts',
          );
        }
        if (!active && Object.keys(input).every((key) => key === 'expectedVersion')) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'At least one editable field is required',
          });
        }

        const locationId = input.clinicLocationId ?? current.clinicLocationId;
        const appointmentId =
          input.appointmentId === undefined ? current.appointmentId : input.appointmentId;
        const assignedId =
          input.assignedGroomerMembershipId === undefined
            ? current.assignedGroomerMembershipId
            : input.assignedGroomerMembershipId;
        if (!active) {
          await this.lockActiveLocation(tx, tenant.organizationId, locationId);
          if (appointmentId) {
            await this.requireAppointment(
              tx,
              tenant.organizationId,
              current.patientId,
              locationId,
              appointmentId,
              appointmentId !== current.appointmentId,
            );
            const linked = await tx.groomingVisit.findFirst({
              where: {
                organizationId: tenant.organizationId,
                appointmentId,
                id: { not: groomingVisitId },
              },
              select: { id: true },
            });
            if (linked)
              throw this.conflict(
                'APPOINTMENT_ALREADY_HAS_GROOMING_VISIT',
                'Appointment already has a grooming visit',
              );
          }
          await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId, assignedId]);
          if (assignedId) await this.requirePerformer(tx, tenant.organizationId, assignedId);
        } else {
          await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
          await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);
          if (!hasPermissions(tenant.role, tenant.clinicalRole, ['grooming.perform'])) {
            throw new ForbiddenException({
              code: 'INSUFFICIENT_PERMISSION',
              message: 'In-progress grooming notes require perform permission',
            });
          }
        }

        if (!active) await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);

        const data: Prisma.GroomingVisitUncheckedUpdateManyInput = { version: { increment: 1 } };
        const changedFields: string[] = [];
        const setText = (
          field: keyof UpdateGroomingVisitDto,
          column: keyof Prisma.GroomingVisitUpdateManyMutationInput,
        ) => {
          if (input[field] !== undefined) {
            (data as Record<string, unknown>)[column] = this.trim(
              input[field] as string | null | undefined,
            );
            changedFields.push(String(field));
          }
        };
        setText('serviceSummary', 'serviceSummary');
        setText('coatCondition', 'coatCondition');
        setText('skinObservations', 'skinObservations');
        setText('temperamentNotes', 'temperamentNotes');
        setText('preServiceNotes', 'preServiceNotes');
        setText('postServiceNotes', 'postServiceNotes');
        setText('incidentNotes', 'incidentNotes');
        if (!active) {
          if (input.clinicLocationId !== undefined) {
            data.clinicLocationId = locationId;
            changedFields.push('clinicLocationId');
          }
          if (input.appointmentId !== undefined) {
            data.appointmentId = appointmentId;
            changedFields.push('appointmentId');
          }
          if (input.assignedGroomerMembershipId !== undefined) {
            data.assignedGroomerMembershipId = assignedId;
            changedFields.push('assignedGroomerMembershipId');
          }
        }
        const updated = await tx.groomingVisit.updateMany({
          where: {
            id: groomingVisitId,
            organizationId: tenant.organizationId,
            version: input.expectedVersion,
            status: current.status,
          },
          data,
        });
        if (updated.count !== 1) throw this.staleVersion(input.expectedVersion, current.version);
        await this.audit(tx, tenant, groomingVisitId, 'GROOMING_UPDATED', {
          status: current.status,
          version: current.version + 1,
          changedFields,
        });
        return groomingVisitId;
      }),
    );
    return this.findOne(tenant, id);
  }

  // Starting locks Patient then Appointment then visit then assigned membership to serialize every invariant.
  async start(
    tenant: TenantContext,
    groomingVisitId: string,
    expectedVersion: number,
  ): Promise<GroomingVisit> {
    const initial = await this.findMutationSnapshot(tenant.organizationId, groomingVisitId);
    const id = await this.prisma.$transaction(async (tx) => {
      await this.lockPatient(tx, tenant.organizationId, initial.patientId);
      let current = await this.findMutationSnapshotTx(tx, tenant.organizationId, groomingVisitId);
      await this.lockOptionalAppointment(tx, tenant.organizationId, current.appointmentId);
      await this.lockVisit(tx, tenant.organizationId, groomingVisitId);
      current = await this.findMutationSnapshotTx(tx, tenant.organizationId, groomingVisitId);
      if (current.version !== expectedVersion)
        throw this.staleVersion(expectedVersion, current.version);
      if (current.status !== GroomingVisitStatus.DRAFT)
        throw this.stateConflict('GROOMING_VISIT_NOT_DRAFT', 'Only a draft visit can start');
      const patient = await this.requireActivePatient(tx, tenant.organizationId, current.patientId);
      if (!current.serviceSummary?.trim())
        throw this.conflict(
          'GROOMING_SERVICE_REQUIRED',
          'A service summary is required before starting',
        );
      if (!current.assignedGroomerMembershipId)
        throw this.conflict('GROOMER_REQUIRED', 'Assign an active groomer before starting');
      await this.lockActiveLocation(tx, tenant.organizationId, current.clinicLocationId);
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        current.assignedGroomerMembershipId,
      ]);
      await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);
      const groomer = await this.requirePerformer(
        tx,
        tenant.organizationId,
        current.assignedGroomerMembershipId,
      );
      if (current.appointmentId) {
        await this.requireAppointment(
          tx,
          tenant.organizationId,
          current.patientId,
          current.clinicLocationId,
          current.appointmentId,
          true,
        );
      }
      const owner = await tx.owner.findFirst({
        where: { id: current.ownerIdAtTime, organizationId: tenant.organizationId },
        select: { firstName: true, lastName: true },
      });
      if (!owner) throw this.notFound('OWNER_NOT_FOUND', 'Historical owner not found');
      const updated = await tx.groomingVisit.updateMany({
        where: {
          id: groomingVisitId,
          organizationId: tenant.organizationId,
          status: GroomingVisitStatus.DRAFT,
          version: expectedVersion,
        },
        data: {
          status: GroomingVisitStatus.IN_PROGRESS,
          startedAt: new Date(),
          startedByMembershipId: tenant.membershipId,
          patientNameSnapshot: patient.name,
          ownerDisplayNameSnapshot: this.ownerName(owner.firstName, owner.lastName),
          groomerDisplayNameSnapshot: groomer.displayName,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.staleVersion(expectedVersion, current.version);
      await this.audit(tx, tenant, groomingVisitId, 'GROOMING_STARTED', {
        status: 'IN_PROGRESS',
        version: expectedVersion + 1,
      });
      return groomingVisitId;
    });
    return this.findOne(tenant, id);
  }

  // Completion is one-way and preserves the Groomer and Patient snapshots established at start.
  async complete(
    tenant: TenantContext,
    groomingVisitId: string,
    input: CompleteGroomingVisitDto,
  ): Promise<GroomingVisit> {
    const initial = await this.findMutationSnapshot(tenant.organizationId, groomingVisitId);
    await this.prisma.$transaction(async (tx) => {
      await this.lockPatient(tx, tenant.organizationId, initial.patientId);
      const current = await this.findMutationSnapshotTx(tx, tenant.organizationId, groomingVisitId);
      await this.lockOptionalAppointment(tx, tenant.organizationId, current.appointmentId);
      await this.lockVisit(tx, tenant.organizationId, groomingVisitId);
      const locked = await this.findMutationSnapshotTx(tx, tenant.organizationId, groomingVisitId);
      if (locked.version !== input.expectedVersion)
        throw this.staleVersion(input.expectedVersion, locked.version);
      if (locked.status !== GroomingVisitStatus.IN_PROGRESS)
        throw this.stateConflict(
          'GROOMING_VISIT_NOT_IN_PROGRESS',
          'Only an in-progress visit can complete',
        );
      await this.requireActivePatient(tx, tenant.organizationId, locked.patientId);
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);
      const updated = await tx.groomingVisit.updateMany({
        where: {
          id: groomingVisitId,
          organizationId: tenant.organizationId,
          status: GroomingVisitStatus.IN_PROGRESS,
          version: input.expectedVersion,
        },
        data: {
          status: GroomingVisitStatus.COMPLETED,
          completedAt: new Date(),
          completedByMembershipId: tenant.membershipId,
          ...(input.postServiceNotes !== undefined
            ? { postServiceNotes: this.trim(input.postServiceNotes) ?? null }
            : {}),
          ...(input.incidentNotes !== undefined
            ? { incidentNotes: this.trim(input.incidentNotes) ?? null }
            : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.staleVersion(input.expectedVersion, locked.version);
      await this.audit(tx, tenant, groomingVisitId, 'GROOMING_COMPLETED', {
        status: 'COMPLETED',
        version: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, groomingVisitId);
  }

  // Voiding retains the complete record and is deliberately restricted to Owner/Admin permissions.
  async void(
    tenant: TenantContext,
    groomingVisitId: string,
    input: VoidGroomingVisitDto,
  ): Promise<GroomingVisit> {
    const initial = await this.findMutationSnapshot(tenant.organizationId, groomingVisitId);
    const reason = input.reason.trim();
    if (!reason)
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'reason is required' });
    await this.prisma.$transaction(async (tx) => {
      await this.lockPatient(tx, tenant.organizationId, initial.patientId);
      const current = await this.findMutationSnapshotTx(tx, tenant.organizationId, groomingVisitId);
      await this.lockOptionalAppointment(tx, tenant.organizationId, current.appointmentId);
      await this.lockVisit(tx, tenant.organizationId, groomingVisitId);
      const locked = await this.findMutationSnapshotTx(tx, tenant.organizationId, groomingVisitId);
      if (locked.version !== input.expectedVersion)
        throw this.staleVersion(input.expectedVersion, locked.version);
      if (
        locked.status !== GroomingVisitStatus.IN_PROGRESS &&
        locked.status !== GroomingVisitStatus.COMPLETED
      ) {
        throw this.stateConflict(
          'GROOMING_VISIT_NOT_VOIDABLE',
          'Only an in-progress or completed visit can be voided',
        );
      }
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);
      const updated = await tx.groomingVisit.updateMany({
        where: {
          id: groomingVisitId,
          organizationId: tenant.organizationId,
          status: locked.status,
          version: input.expectedVersion,
        },
        data: {
          status: GroomingVisitStatus.VOIDED,
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.staleVersion(input.expectedVersion, locked.version);
      await this.audit(tx, tenant, groomingVisitId, 'GROOMING_VOIDED', {
        status: 'VOIDED',
        version: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, groomingVisitId);
  }

  private buildWhere(
    organizationId: string,
    query: GroomingVisitListQueryDto,
  ): Prisma.GroomingVisitWhereInput {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'from must not be after to',
      });
    }
    return {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.clinicLocationId ? { clinicLocationId: query.clinicLocationId } : {}),
      ...(query.assignedGroomerMembershipId
        ? { assignedGroomerMembershipId: query.assignedGroomerMembershipId }
        : {}),
      ...(query.appointmentId ? { appointmentId: query.appointmentId } : {}),
      ...(query.from || query.to
        ? {
            appointment: {
              startsAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            },
          }
        : {}),
    };
  }

  // SQL CASE gives a stable queue rank without loading all tenant history into application memory.
  private async queueIds(
    organizationId: string,
    query: GroomingVisitListQueryDto,
  ): Promise<string[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`g."organization_id" = ${organizationId}::uuid`];
    if (query.status)
      conditions.push(Prisma.sql`g."status" = ${query.status}::"GroomingVisitStatus"`);
    if (query.patientId) conditions.push(Prisma.sql`g."patient_id" = ${query.patientId}::uuid`);
    if (query.clinicLocationId)
      conditions.push(Prisma.sql`g."clinic_location_id" = ${query.clinicLocationId}::uuid`);
    if (query.assignedGroomerMembershipId)
      conditions.push(
        Prisma.sql`g."assigned_groomer_membership_id" = ${query.assignedGroomerMembershipId}::uuid`,
      );
    if (query.appointmentId)
      conditions.push(Prisma.sql`g."appointment_id" = ${query.appointmentId}::uuid`);
    if (query.from) conditions.push(Prisma.sql`a."starts_at" >= ${new Date(query.from)}`);
    if (query.to) conditions.push(Prisma.sql`a."starts_at" <= ${new Date(query.to)}`);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT g."id"
      FROM "grooming_visits" g
      LEFT JOIN "appointments" a ON a."id" = g."appointment_id" AND a."organization_id" = g."organization_id"
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY CASE g."status" WHEN 'IN_PROGRESS' THEN 0 WHEN 'DRAFT' THEN 1 WHEN 'COMPLETED' THEN 2 ELSE 3 END,
        CASE WHEN g."status" IN ('IN_PROGRESS', 'DRAFT') THEN COALESCE(a."starts_at", g."updated_at") END ASC,
        CASE WHEN g."status" IN ('COMPLETED', 'VOIDED') THEN g."updated_at" END DESC,
        g."id" ASC
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
    `);
    return rows.map((row) => row.id);
  }

  private async listFromIds(
    tenant: TenantContext,
    ids: string[],
    page: number,
    pageSize: number,
    total: number,
  ): Promise<GroomingVisitListResponse> {
    if (!ids.length) return this.toList(tenant, [], page, pageSize, total);
    const records = await this.prisma.groomingVisit.findMany({
      where: { organizationId: tenant.organizationId, id: { in: ids } },
      select: visitSelect,
    });
    const recordById = new Map(records.map((record) => [record.id, record]));
    return this.toList(
      tenant,
      ids.flatMap((id) => (recordById.has(id) ? [recordById.get(id)!] : [])),
      page,
      pageSize,
      total,
    );
  }

  private toList(
    tenant: TenantContext,
    records: VisitRecord[],
    page: number,
    pageSize: number,
    total: number,
  ): GroomingVisitListResponse {
    return {
      data: records.map((record) => this.toResponse(tenant, record)),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // Snapshot values win after service starts; drafts use the Owner captured when the draft was created.
  private toResponse(tenant: TenantContext, record: VisitRecord): GroomingVisit {
    const mayReadAppointment = hasPermissions(tenant.role, tenant.clinicalRole, [
      'appointments.read',
    ]);
    const ownerName =
      record.ownerDisplayNameSnapshot ??
      this.ownerName(record.ownerAtTime.firstName, record.ownerAtTime.lastName);
    const assigned = record.assignedGroomerMembership;
    return {
      id: record.id,
      patientId: record.patientId,
      ownerIdAtTime: record.ownerIdAtTime,
      clinicLocationId: record.clinicLocationId,
      appointmentId: mayReadAppointment ? record.appointmentId : null,
      assignedGroomerMembershipId: record.assignedGroomerMembershipId,
      createdByMembershipId: record.createdByMembershipId,
      startedByMembershipId: record.startedByMembershipId,
      completedByMembershipId: record.completedByMembershipId,
      voidedByMembershipId: record.voidedByMembershipId,
      status: record.status,
      version: record.version,
      serviceSummary: record.serviceSummary,
      coatCondition: record.coatCondition,
      skinObservations: record.skinObservations,
      temperamentNotes: record.temperamentNotes,
      preServiceNotes: record.preServiceNotes,
      postServiceNotes: record.postServiceNotes,
      incidentNotes: record.incidentNotes,
      patientNameSnapshot: record.patientNameSnapshot,
      ownerDisplayNameSnapshot: record.ownerDisplayNameSnapshot,
      groomerDisplayNameSnapshot: record.groomerDisplayNameSnapshot,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      voidedAt: record.voidedAt?.toISOString() ?? null,
      voidReason: record.voidReason,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      patient: record.patient,
      ownerAtTime: { id: record.ownerAtTime.id, displayName: ownerName },
      clinicLocation: record.clinicLocation,
      appointment:
        mayReadAppointment && record.appointment
          ? {
              id: record.appointment.id,
              status: record.appointment.status,
              startsAt: record.appointment.startsAt.toISOString(),
              reason: record.appointment.reason,
            }
          : null,
      assignedGroomer: assigned
        ? {
            id: assigned.id,
            role: assigned.role,
            displayName:
              record.groomerDisplayNameSnapshot ??
              this.memberName(assigned.professionalProfile?.displayName, assigned.role),
          }
        : null,
      createdBy: {
        id: record.createdByMembership.id,
        role: record.createdByMembership.role,
        displayName: this.memberName(
          record.createdByMembership.professionalProfile?.displayName,
          record.createdByMembership.role,
        ),
      },
      completedBy: record.completedByMembership
        ? {
            id: record.completedByMembership.id,
            role: record.completedByMembership.role,
            displayName: this.memberName(
              record.completedByMembership.professionalProfile?.displayName,
              record.completedByMembership.role,
            ),
          }
        : null,
      voidedBy: record.voidedByMembership
        ? {
            id: record.voidedByMembership.id,
            role: record.voidedByMembership.role,
            displayName: this.memberName(
              record.voidedByMembership.professionalProfile?.displayName,
              record.voidedByMembership.role,
            ),
          }
        : null,
    };
  }

  private async requireActivePatient(tx: Transaction, organizationId: string, patientId: string) {
    const patient = await tx.patient.findFirst({
      where: { id: patientId, organizationId },
      select: { id: true, ownerId: true, name: true, status: true },
    });
    if (!patient) throw this.notFound('PATIENT_NOT_FOUND', 'Patient not found');
    if (patient.status !== PatientStatus.ACTIVE)
      throw this.conflict(
        'PATIENT_ARCHIVED',
        'Archived patients cannot be used for grooming operations',
      );
    return patient;
  }

  // Locks ensure that appointment cancellation and no-show transitions cannot race visit start.
  private async requireAppointment(
    tx: Transaction,
    organizationId: string,
    patientId: string,
    locationId: string,
    appointmentId: string,
    rejectTerminal: boolean,
  ) {
    const appointment = await tx.appointment.findFirst({
      where: { id: appointmentId, organizationId },
      select: { id: true, patientId: true, clinicLocationId: true, status: true },
    });
    if (
      !appointment ||
      appointment.patientId !== patientId ||
      appointment.clinicLocationId !== locationId
    ) {
      throw this.notFound(
        'APPOINTMENT_NOT_FOUND',
        'Appointment not found for this Patient and location',
      );
    }
    if (rejectTerminal && terminalAppointmentStates.includes(appointment.status)) {
      throw this.conflict(
        'APPOINTMENT_NOT_ELIGIBLE',
        'Cancelled or no-show appointments cannot be linked',
      );
    }
    return appointment;
  }

  private async lockActiveLocation(
    tx: Transaction,
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "clinic_locations" WHERE "id" = ${locationId}::uuid AND "organization_id" = ${organizationId}::uuid FOR SHARE`,
    );
    const location = await tx.clinicLocation.findFirst({
      where: { id: locationId, organizationId },
      select: { status: true },
    });
    if (!location || location.status !== ClinicLocationStatus.ACTIVE)
      throw this.conflict('CLINIC_LOCATION_INACTIVE', 'Select an active clinic location');
  }

  private async requirePerformer(tx: Transaction, organizationId: string, membershipId: string) {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        role: true,
        clinicalRole: true,
        professionalProfile: { select: { displayName: true } },
      },
    });
    if (
      !membership ||
      !hasPermissions(membership.role, membership.clinicalRole, ['grooming.perform'])
    ) {
      throw this.conflict(
        'GROOMER_NOT_ELIGIBLE',
        'Assigned membership must be active and permitted to perform grooming',
      );
    }
    return {
      ...membership,
      displayName: this.memberName(membership.professionalProfile?.displayName, membership.role),
    };
  }

  // The same lock protects a request from succeeding after its acting membership was suspended.
  private async requireActiveActor(
    tx: Transaction,
    organizationId: string,
    membershipId: string,
  ): Promise<void> {
    const actor = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!actor)
      throw new ForbiddenException({
        code: 'MEMBERSHIP_INACTIVE',
        message: 'The active membership is not available',
      });
  }

  private async findMutationSnapshot(organizationId: string, id: string) {
    const visit = await this.prisma.groomingVisit.findFirst({
      where: { id, organizationId },
      select: { patientId: true },
    });
    if (!visit) throw this.notFound('GROOMING_VISIT_NOT_FOUND', 'Grooming visit not found');
    return visit;
  }

  private async findMutationSnapshotTx(tx: Transaction, organizationId: string, id: string) {
    const visit = await tx.groomingVisit.findFirst({
      where: { id, organizationId },
      select: {
        patientId: true,
        appointmentId: true,
        assignedGroomerMembershipId: true,
        ownerIdAtTime: true,
        clinicLocationId: true,
        status: true,
        version: true,
        serviceSummary: true,
      },
    });
    if (!visit) throw this.notFound('GROOMING_VISIT_NOT_FOUND', 'Grooming visit not found');
    return visit;
  }

  private async lockPatient(
    tx: Transaction,
    organizationId: string,
    patientId: string,
  ): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "patients" WHERE "id" = ${patientId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  private async lockOptionalAppointment(
    tx: Transaction,
    organizationId: string,
    appointmentId: string | null,
  ): Promise<void> {
    if (!appointmentId) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "appointments" WHERE "id" = ${appointmentId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  private async lockVisit(tx: Transaction, organizationId: string, id: string): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "grooming_visits" WHERE "id" = ${id}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  // Membership locks are sorted to keep reassignment and lifecycle actions deadlock-safe.
  private async lockMemberships(
    tx: Transaction,
    organizationId: string,
    ids: Array<string | null | undefined>,
  ): Promise<void> {
    for (const id of [...new Set(ids.filter((value): value is string => Boolean(value)))].sort()) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "memberships" WHERE "id" = ${id}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
      );
    }
  }

  // Audit metadata describes lifecycle facts or changed field names only, never narrative notes.
  private async audit(
    tx: Transaction,
    tenant: TenantContext,
    groomingVisitId: string,
    action:
      | 'GROOMING_CREATED'
      | 'GROOMING_UPDATED'
      | 'GROOMING_STARTED'
      | 'GROOMING_COMPLETED'
      | 'GROOMING_VOIDED',
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await tx.operationalAuditEvent.create({
      data: {
        organizationId: tenant.organizationId,
        groomingVisitId,
        actorMembershipId: tenant.membershipId,
        action,
        metadata,
      },
    });
  }

  private async withAppointmentConflict<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.conflict(
          'APPOINTMENT_ALREADY_HAS_GROOMING_VISIT',
          'Appointment already has a grooming visit',
        );
      }
      throw error;
    }
  }

  private trim(value: string | null | undefined): string | null | undefined {
    if (value === undefined || value === null) return value;
    return value.trim() || null;
  }

  private ownerName(firstName: string, lastName: string | null): string {
    return [firstName, lastName].filter(Boolean).join(' ');
  }

  private memberName(displayName: string | null | undefined, role: MembershipRole): string {
    if (displayName?.trim()) return displayName.trim();
    const names: Record<MembershipRole, string> = {
      OWNER: 'Propietario',
      ADMIN: 'Administrador',
      VETERINARIAN: 'Veterinario',
      ASSISTANT: 'Asistente',
      RECEPTION: 'Recepción',
      GROOMER: 'Peluquero/a',
      CASHIER: 'Caja',
    };
    return names[role];
  }

  private staleVersion(expected: number, actual: number): ConflictException {
    return new ConflictException({
      code: 'STALE_GROOMING_VISIT',
      message: 'Grooming visit changed; reload before retrying',
      expectedVersion: expected,
      actualVersion: actual,
    });
  }

  private stateConflict(code: string, message: string): ConflictException {
    return new ConflictException({ code, message });
  }
  private conflict(code: string, message: string): ConflictException {
    return new ConflictException({ code, message });
  }
  private notFound(code: string, message: string): NotFoundException {
    return new NotFoundException({ code, message });
  }
}
