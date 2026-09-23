import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalEncounterStatus,
  ClinicalFollowUpStatus,
  ClinicalRole,
  MembershipStatus,
  PatientStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type {
  ClinicalFollowUpDashboard,
  ClinicalFollowUpDetail,
  ClinicalFollowUpListResponse,
  ClinicalFollowUpSummary,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  ClinicalFollowUpListQueryDto,
  CompleteClinicalFollowUpDto,
  CreateClinicalFollowUpDto,
  UpdateClinicalFollowUpDto,
} from './follow-ups.dto';

type Transaction = Prisma.TransactionClient;

const summarySelect = {
  id: true,
  organizationId: true,
  patientId: true,
  sourceClinicalEncounterId: true,
  status: true,
  version: true,
  title: true,
  reason: true,
  dueOn: true,
  reminderAt: true,
  assignedMembershipId: true,
  createdByMembershipId: true,
  completedAt: true,
  completedByMembershipId: true,
  outcome: true,
  voidedAt: true,
  voidedByMembershipId: true,
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
  sourceClinicalEncounter: {
    select: { id: true, status: true, reason: true, occurredAt: true },
  },
  assignedMembership: {
    select: {
      id: true,
      clinicalRole: true,
      professionalProfile: { select: { displayName: true } },
    },
  },
  createdByMembership: {
    select: { id: true, professionalProfile: { select: { displayName: true } } },
  },
  completedByMembership: {
    select: { id: true, professionalProfile: { select: { displayName: true } } },
  },
} as const satisfies Prisma.ClinicalFollowUpSelect;

const detailSelect = {
  ...summarySelect,
  notes: true,
  completionNotes: true,
  patientNameSnapshot: true,
  ownerDisplayNameSnapshot: true,
  professionalDisplayNameSnapshot: true,
  professionalLicenseSnapshot: true,
  voidedByMembership: {
    select: { id: true, professionalProfile: { select: { displayName: true } } },
  },
} as const satisfies Prisma.ClinicalFollowUpSelect;

type FollowUpSummaryRecord = Prisma.ClinicalFollowUpGetPayload<{ select: typeof summarySelect }>;
type FollowUpDetailRecord = Prisma.ClinicalFollowUpGetPayload<{ select: typeof detailSelect }>;

// ClinicalFollowUpsService owns tenant-safe queue queries, lifecycle, snapshots, locking and audit privacy.
@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns the tenant's bounded operational queue using deterministic sort and pagination.
  async list(
    tenant: TenantContext,
    query: ClinicalFollowUpListQueryDto,
  ): Promise<ClinicalFollowUpListResponse> {
    this.validateDateRange(query.dueFrom, query.dueTo);
    const now = new Date();
    const where = this.buildWhere(tenant.organizationId, query);
    const [records, total] = await Promise.all([
      this.prisma.clinicalFollowUp.findMany({
        where,
        select: summarySelect,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.clinicalFollowUp.count({ where }),
    ]);
    return this.toList(records, query.page, query.pageSize, total, now);
  }

  // Patient history includes every status and defaults to the most recently due tasks first.
  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: ClinicalFollowUpListQueryDto,
  ): Promise<ClinicalFollowUpListResponse> {
    this.validateDateRange(query.dueFrom, query.dueTo);
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!patient) throw this.notFound('PATIENT_NOT_FOUND', 'Patient not found');
    const now = new Date();
    const where: Prisma.ClinicalFollowUpWhereInput = {
      ...this.buildWhere(tenant.organizationId, query),
      patientId,
    };
    const [records, total] = await Promise.all([
      this.prisma.clinicalFollowUp.findMany({
        where,
        select: summarySelect,
        orderBy: this.orderBy(query.sort === 'due_asc' ? 'due_desc' : query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.clinicalFollowUp.count({ where }),
    ]);
    return this.toList(records, query.page, query.pageSize, total, now);
  }

  // Resolves dashboard counts against the Organization timezone without making dashboard availability critical.
  async dashboard(tenant: TenantContext): Promise<ClinicalFollowUpDashboard> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { timezone: true },
    });
    if (!organization) throw this.notFound('RESOURCE_NOT_FOUND', 'Organization not found');
    const now = new Date();
    const today = civilDateInTimezone(now, organization.timezone);
    const todayDate = parseCivilDate(today);
    const tomorrow = addCivilDays(todayDate, 1);
    const nextWeek = addCivilDays(todayDate, 7);
    const openWhere: Prisma.ClinicalFollowUpWhereInput = {
      organizationId: tenant.organizationId,
      status: ClinicalFollowUpStatus.OPEN,
    };
    const [overdue, dueToday, upcoming7Days, remindersDue, records] = await Promise.all([
      this.prisma.clinicalFollowUp.count({
        where: { ...openWhere, dueOn: { lt: todayDate } },
      }),
      this.prisma.clinicalFollowUp.count({
        where: { ...openWhere, dueOn: todayDate },
      }),
      this.prisma.clinicalFollowUp.count({
        where: { ...openWhere, dueOn: { gte: tomorrow, lte: nextWeek } },
      }),
      this.prisma.clinicalFollowUp.count({
        where: { ...openWhere, reminderAt: { not: null, lte: now } },
      }),
      this.prisma.clinicalFollowUp.findMany({
        where: openWhere,
        select: summarySelect,
        orderBy: this.orderBy('due_asc'),
        take: 5,
      }),
    ]);
    return {
      timezone: organization.timezone,
      today,
      counts: { overdue, today: dueToday, upcoming7Days, remindersDue },
      nextItems: records.map((record) => this.toSummary(record, now)),
    };
  }

  // Detail reads are tenant scoped and expose only clinical summaries, never User contact data.
  async findOne(tenant: TenantContext, followUpId: string): Promise<ClinicalFollowUpDetail> {
    const record = await this.prisma.clinicalFollowUp.findFirst({
      where: { id: followUpId, organizationId: tenant.organizationId },
      select: detailSelect,
    });
    if (!record) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
    return this.toDetail(record, new Date());
  }

  // Create serializes with Patient archival and source Encounter void, then records a privacy-safe audit.
  async create(
    tenant: TenantContext,
    patientId: string,
    input: CreateClinicalFollowUpDto,
  ): Promise<ClinicalFollowUpDetail> {
    const title = this.requireText(input.title, 'FOLLOW_UP_TITLE_REQUIRED', 'title');
    const dueOn = parseCivilDate(input.dueOn);
    const reminderAt = input.reminderAt ? parseInstant(input.reminderAt) : null;
    const reason = trimNullable(input.reason) ?? null;
    const notes = trimNullable(input.notes) ?? null;
    const assignedMembershipId = input.assignedMembershipId ?? null;
    const sourceId = input.sourceClinicalEncounterId ?? null;
    const createdId = await this.transactionWithEncounterRetry(() =>
      this.prisma.$transaction(async (tx) => {
        await this.lockPatient(tx, tenant.organizationId, patientId);
        const patient = await tx.patient.findFirst({
          where: { id: patientId, organizationId: tenant.organizationId },
          select: { id: true, status: true },
        });
        if (!patient) throw this.notFound('PATIENT_NOT_FOUND', 'Patient not found');
        if (patient.status !== PatientStatus.ACTIVE) throw this.patientArchived();

        const source = sourceId
          ? await this.lockAndRequireEligibleEncounter(
              tx,
              tenant.organizationId,
              patientId,
              sourceId,
            )
          : null;
        const membershipIds = [tenant.membershipId, assignedMembershipId];
        await this.lockMemberships(tx, tenant.organizationId, membershipIds);
        await this.requireClinicalActor(tx, tenant, ['PRACTITIONER', 'CLINICAL_ASSISTANT']);
        if (assignedMembershipId) {
          await this.requireAssignableMembership(tx, tenant.organizationId, assignedMembershipId);
        }

        const created = await tx.clinicalFollowUp.create({
          data: {
            organizationId: tenant.organizationId,
            patientId,
            sourceClinicalEncounterId: source?.id ?? null,
            status: ClinicalFollowUpStatus.OPEN,
            version: 1,
            title,
            reason,
            dueOn,
            reminderAt,
            assignedMembershipId,
            notes,
            createdByMembershipId: tenant.membershipId,
          },
          select: { id: true },
        });
        await this.audit(tx, tenant, created.id, 'FOLLOW_UP_CREATED', {
          status: ClinicalFollowUpStatus.OPEN,
          version: 1,
        });
        return created.id;
      }),
    );
    return this.findOne(tenant, createdId);
  }

  // Updates only OPEN tasks, validates changed references under row locks and never bumps a no-op.
  async update(
    tenant: TenantContext,
    followUpId: string,
    input: UpdateClinicalFollowUpDto,
  ): Promise<ClinicalFollowUpDetail> {
    const updatedId = await this.transactionWithEncounterRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const identity = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: { patientId: true },
        });
        if (!identity) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        await this.lockPatient(tx, tenant.organizationId, identity.patientId);
        const patient = await tx.patient.findFirst({
          where: { id: identity.patientId, organizationId: tenant.organizationId },
          select: { id: true, status: true },
        });
        if (!patient) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        if (patient.status !== PatientStatus.ACTIVE) throw this.patientArchived();

        const beforeParentLock = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: { sourceClinicalEncounterId: true },
        });
        if (!beforeParentLock) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        const newSourceId =
          input.sourceClinicalEncounterId === undefined
            ? beforeParentLock.sourceClinicalEncounterId
            : input.sourceClinicalEncounterId;
        const encounterIds = uniqueSorted([
          beforeParentLock.sourceClinicalEncounterId,
          newSourceId,
        ]);
        const encounters = new Map<string, EncounterLockRecord>();
        for (const encounterId of encounterIds) {
          encounters.set(
            encounterId,
            await this.lockAndReadEncounter(
              tx,
              tenant.organizationId,
              identity.patientId,
              encounterId,
            ),
          );
        }
        await this.lockFollowUp(tx, tenant.organizationId, followUpId);
        const current = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: detailSelect,
        });
        if (!current) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        if (current.status !== ClinicalFollowUpStatus.OPEN) throw this.immutable();
        if (current.version !== input.expectedVersion) throw this.stale();

        if (current.sourceClinicalEncounterId) {
          this.requireEligibleEncounter(encounters.get(current.sourceClinicalEncounterId)!);
        }
        if (newSourceId) {
          this.requireEligibleEncounter(encounters.get(newSourceId)!);
        }

        const data: Prisma.ClinicalFollowUpUncheckedUpdateManyInput = {};
        const changedFieldNames: string[] = [];
        if (input.title !== undefined) {
          const next = this.requireText(input.title, 'FOLLOW_UP_TITLE_REQUIRED', 'title');
          if (next !== current.title) {
            data.title = next;
            changedFieldNames.push('title');
          }
        }
        if (input.reason !== undefined) {
          const next = trimNullable(input.reason) ?? null;
          if (next !== current.reason) {
            data.reason = next;
            changedFieldNames.push('reason');
          }
        }
        if (input.dueOn !== undefined) {
          const next = parseCivilDate(input.dueOn);
          if (formatCivilDate(next) !== formatCivilDate(current.dueOn)) {
            data.dueOn = next;
            changedFieldNames.push('dueOn');
          }
        }
        if (input.reminderAt !== undefined) {
          const next = input.reminderAt ? parseInstant(input.reminderAt) : null;
          if (next?.getTime() !== current.reminderAt?.getTime()) {
            data.reminderAt = next;
            changedFieldNames.push('reminderAt');
          }
        }
        if (input.assignedMembershipId !== undefined) {
          const next = input.assignedMembershipId;
          if (next !== current.assignedMembershipId) {
            data.assignedMembershipId = next;
            changedFieldNames.push('assignedMembershipId');
          }
        }
        if (input.sourceClinicalEncounterId !== undefined) {
          const next = input.sourceClinicalEncounterId;
          if (next !== current.sourceClinicalEncounterId) {
            data.sourceClinicalEncounterId = next;
            changedFieldNames.push('sourceClinicalEncounterId');
          }
        }
        if (input.notes !== undefined) {
          const next = trimNullable(input.notes) ?? null;
          if (next !== current.notes) {
            data.notes = next;
            changedFieldNames.push('notes');
          }
        }
        if (changedFieldNames.length === 0) {
          throw this.badRequest('FOLLOW_UP_NO_CHANGES', 'At least one changed field is required');
        }

        const membershipIds = [tenant.membershipId];
        if (input.assignedMembershipId) membershipIds.push(input.assignedMembershipId);
        await this.lockMemberships(tx, tenant.organizationId, membershipIds);
        await this.requireClinicalActor(tx, tenant, ['PRACTITIONER', 'CLINICAL_ASSISTANT']);
        if (input.assignedMembershipId) {
          await this.requireAssignableMembership(
            tx,
            tenant.organizationId,
            input.assignedMembershipId,
          );
        }

        const result = await tx.clinicalFollowUp.updateMany({
          where: {
            id: followUpId,
            organizationId: tenant.organizationId,
            status: ClinicalFollowUpStatus.OPEN,
            version: input.expectedVersion,
          },
          data: { ...data, version: { increment: 1 } },
        });
        if (result.count !== 1) throw this.stale();
        await this.audit(tx, tenant, followUpId, 'FOLLOW_UP_UPDATED', {
          previousVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
          changedFieldNames,
        });
        return followUpId;
      }),
    );
    return this.findOne(tenant, updatedId);
  }

  // Completion snapshots the patient, responsible owner and completing Practitioner in one transaction.
  async complete(
    tenant: TenantContext,
    followUpId: string,
    input: CompleteClinicalFollowUpDto,
  ): Promise<ClinicalFollowUpDetail> {
    const outcome = this.requireText(input.outcome, 'FOLLOW_UP_OUTCOME_REQUIRED', 'outcome');
    const completionNotes = trimNullable(input.completionNotes) ?? null;
    const completedAt = new Date();
    const completedId = await this.transactionWithEncounterRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const identity = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: { patientId: true },
        });
        if (!identity) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        await this.lockPatient(tx, tenant.organizationId, identity.patientId);
        const patient = await tx.patient.findFirst({
          where: { id: identity.patientId, organizationId: tenant.organizationId },
          select: {
            id: true,
            name: true,
            status: true,
            ownerId: true,
            owner: { select: { id: true } },
          },
        });
        if (!patient) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        if (patient.status !== PatientStatus.ACTIVE) throw this.patientArchived();
        const beforeParentLock = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: { sourceClinicalEncounterId: true },
        });
        if (!beforeParentLock) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        const source = beforeParentLock.sourceClinicalEncounterId
          ? await this.lockAndRequireEligibleEncounter(
              tx,
              tenant.organizationId,
              identity.patientId,
              beforeParentLock.sourceClinicalEncounterId,
            )
          : null;
        await this.lockFollowUp(tx, tenant.organizationId, followUpId);
        const current = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: { status: true, version: true, sourceClinicalEncounterId: true },
        });
        if (!current) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        if (current.status !== ClinicalFollowUpStatus.OPEN) {
          throw this.conflict('INVALID_FOLLOW_UP_STATE', 'Only open follow-ups can be completed');
        }
        if (current.version !== input.expectedVersion) throw this.stale();
        if (current.sourceClinicalEncounterId !== (source?.id ?? null)) {
          throw this.conflict('FOLLOW_UP_STALE', 'Follow-up source changed; reload and try again');
        }

        const ownerId = source?.ownerIdAtTime ?? patient.ownerId;
        const owner = await this.lockAndReadOwner(tx, tenant.organizationId, ownerId);
        const membershipIds = [tenant.membershipId];
        await this.lockMemberships(tx, tenant.organizationId, membershipIds);
        const actor = await this.requireClinicalActor(tx, tenant, ['PRACTITIONER']);
        const displayName = actor.professionalProfile?.displayName?.trim();
        if (!displayName) {
          throw this.conflict(
            'PROFESSIONAL_PROFILE_REQUIRED',
            'A professional profile is required to complete the follow-up',
          );
        }
        const ownerDisplayName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
        const result = await tx.clinicalFollowUp.updateMany({
          where: {
            id: followUpId,
            organizationId: tenant.organizationId,
            status: ClinicalFollowUpStatus.OPEN,
            version: input.expectedVersion,
          },
          data: {
            status: ClinicalFollowUpStatus.COMPLETED,
            completedAt,
            completedByMembershipId: tenant.membershipId,
            outcome,
            completionNotes,
            patientNameSnapshot: patient.name,
            ownerDisplayNameSnapshot: ownerDisplayName,
            professionalDisplayNameSnapshot: displayName,
            professionalLicenseSnapshot: actor.professionalProfile?.licenseNumber?.trim() || null,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) throw this.stale();
        await this.audit(tx, tenant, followUpId, 'FOLLOW_UP_COMPLETED', {
          previousVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
          fromStatus: ClinicalFollowUpStatus.OPEN,
          toStatus: ClinicalFollowUpStatus.COMPLETED,
        });
        return followUpId;
      }),
    );
    return this.findOne(tenant, completedId);
  }

  // Void is a historical correction and remains available after Patient archive or source Encounter void.
  async void(
    tenant: TenantContext,
    followUpId: string,
    expectedVersion: number,
    reasonInput: string,
  ): Promise<ClinicalFollowUpDetail> {
    const reason = this.requireText(reasonInput, 'VALIDATION_ERROR', 'reason');
    const voidedAt = new Date();
    const voidedId = await this.transactionWithEncounterRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const identity = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: { patientId: true },
        });
        if (!identity) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        await this.lockPatient(tx, tenant.organizationId, identity.patientId);
        const parent = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: { sourceClinicalEncounterId: true },
        });
        if (!parent) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        if (parent.sourceClinicalEncounterId) {
          await this.lockAndReadEncounter(
            tx,
            tenant.organizationId,
            identity.patientId,
            parent.sourceClinicalEncounterId,
          );
        }
        await this.lockFollowUp(tx, tenant.organizationId, followUpId);
        const current = await tx.clinicalFollowUp.findFirst({
          where: { id: followUpId, organizationId: tenant.organizationId },
          select: { status: true, version: true },
        });
        if (!current) throw this.notFound('FOLLOW_UP_NOT_FOUND', 'Follow-up not found');
        if (
          current.status !== ClinicalFollowUpStatus.OPEN &&
          current.status !== ClinicalFollowUpStatus.COMPLETED
        ) {
          throw this.conflict('INVALID_FOLLOW_UP_STATE', 'This follow-up cannot be voided');
        }
        if (current.version !== expectedVersion) throw this.stale();
        await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
        await this.requireClinicalActor(tx, tenant, ['PRACTITIONER']);
        const result = await tx.clinicalFollowUp.updateMany({
          where: {
            id: followUpId,
            organizationId: tenant.organizationId,
            status: current.status,
            version: expectedVersion,
          },
          data: {
            status: ClinicalFollowUpStatus.VOIDED,
            voidedAt,
            voidedByMembershipId: tenant.membershipId,
            voidReason: reason,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) throw this.stale();
        await this.audit(tx, tenant, followUpId, 'FOLLOW_UP_VOIDED', {
          previousVersion: expectedVersion,
          newVersion: expectedVersion + 1,
          fromStatus: current.status,
          toStatus: ClinicalFollowUpStatus.VOIDED,
        });
        return followUpId;
      }),
    );
    return this.findOne(tenant, voidedId);
  }

  // Constructs tenant and filter predicates without interpolating raw SQL or exposing another tenant's rows.
  private buildWhere(
    organizationId: string,
    query: ClinicalFollowUpListQueryDto,
  ): Prisma.ClinicalFollowUpWhereInput {
    return {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.assignedMembershipId ? { assignedMembershipId: query.assignedMembershipId } : {}),
      ...(query.sourceClinicalEncounterId
        ? { sourceClinicalEncounterId: query.sourceClinicalEncounterId }
        : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueOn: {
              ...(query.dueFrom ? { gte: parseCivilDate(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: parseCivilDate(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(query.reminderBefore
        ? { reminderAt: { not: null, lte: parseInstant(query.reminderBefore) } }
        : {}),
    };
  }

  // Every sort includes stable tie-breaks so pagination remains repeatable while the queue changes.
  private orderBy(
    sort: ClinicalFollowUpListQueryDto['sort'],
  ): Prisma.ClinicalFollowUpOrderByWithRelationInput[] {
    if (sort === 'created_desc') return [{ createdAt: 'desc' }, { id: 'asc' }];
    if (sort === 'due_desc') {
      return [{ dueOn: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
    }
    return [{ dueOn: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }];
  }

  // Maps persistence dates and names into the small clinical summary contract.
  private toSummary(record: FollowUpSummaryRecord, now: Date): ClinicalFollowUpSummary {
    return {
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      sourceClinicalEncounterId: record.sourceClinicalEncounterId,
      status: record.status,
      version: record.version,
      title: record.title,
      reason: record.reason,
      dueOn: formatCivilDate(record.dueOn),
      reminderAt: record.reminderAt?.toISOString() ?? null,
      reminderDue:
        record.status === ClinicalFollowUpStatus.OPEN &&
        record.reminderAt !== null &&
        record.reminderAt.getTime() <= now.getTime(),
      assignedMembershipId: record.assignedMembershipId,
      createdByMembershipId: record.createdByMembershipId,
      completedAt: record.completedAt?.toISOString() ?? null,
      completedByMembershipId: record.completedByMembershipId,
      outcome: record.outcome,
      voidedAt: record.voidedAt?.toISOString() ?? null,
      voidedByMembershipId: record.voidedByMembershipId,
      voidReason: record.voidReason,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      patient: {
        id: record.patient.id,
        name: record.patient.name,
        species: record.patient.species,
        status: record.patient.status,
        owner: {
          id: record.patient.owner.id,
          displayName: [record.patient.owner.firstName, record.patient.owner.lastName]
            .filter(Boolean)
            .join(' '),
        },
      },
      sourceEncounter: record.sourceClinicalEncounter
        ? {
            id: record.sourceClinicalEncounter.id,
            status: record.sourceClinicalEncounter.status,
            reason: record.sourceClinicalEncounter.reason,
            occurredAt: record.sourceClinicalEncounter.occurredAt.toISOString(),
          }
        : null,
      assignedMember: record.assignedMembership
        ? {
            membershipId: record.assignedMembership.id,
            displayName: record.assignedMembership.professionalProfile?.displayName ?? null,
            clinicalRole: record.assignedMembership.clinicalRole,
          }
        : null,
      createdBy: this.actorSummary(record.createdByMembership),
      completedBy: record.completedByMembership
        ? this.actorSummary(record.completedByMembership)
        : null,
    };
  }

  // Maps completion-only snapshots and void actor into the detail contract without returning User email.
  private toDetail(record: FollowUpDetailRecord, now: Date): ClinicalFollowUpDetail {
    return {
      ...this.toSummary(record, now),
      notes: record.notes,
      completionNotes: record.completionNotes,
      patientNameSnapshot: record.patientNameSnapshot,
      ownerDisplayNameSnapshot: record.ownerDisplayNameSnapshot,
      professionalDisplayNameSnapshot: record.professionalDisplayNameSnapshot,
      professionalLicenseSnapshot: record.professionalLicenseSnapshot,
      voidedBy: record.voidedByMembership ? this.actorSummary(record.voidedByMembership) : null,
    };
  }

  // Converts a page using one request-time instant so all reminder badges are consistent.
  private toList(
    records: FollowUpSummaryRecord[],
    page: number,
    pageSize: number,
    total: number,
    now: Date,
  ): ClinicalFollowUpListResponse {
    return {
      data: records.map((record) => this.toSummary(record, now)),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // Membership summaries intentionally omit User and contact information.
  private actorSummary(record: {
    id: string;
    professionalProfile: { displayName: string } | null;
  }) {
    return {
      membershipId: record.id,
      displayName: record.professionalProfile?.displayName ?? null,
    };
  }

  // Locks are acquired in Patient → Encounter → FollowUp → Owner → Membership order.
  private async lockPatient(
    tx: Transaction,
    organizationId: string,
    patientId: string,
  ): Promise<void> {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "patients"
      WHERE "id" = ${patientId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  // NOWAIT prevents a cycle with older clinical writers that hold Encounter before Patient; the transaction is retried.
  private async lockAndReadEncounter(
    tx: Transaction,
    organizationId: string,
    patientId: string,
    encounterId: string,
  ): Promise<EncounterLockRecord> {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "clinical_encounters"
      WHERE "id" = ${encounterId}::uuid
        AND "organization_id" = ${organizationId}::uuid
        AND "patient_id" = ${patientId}::uuid
      FOR UPDATE NOWAIT
    `);
    const encounter = await tx.clinicalEncounter.findFirst({
      where: { id: encounterId, organizationId, patientId },
      select: { id: true, status: true, ownerIdAtTime: true },
    });
    if (!encounter) {
      throw this.notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
    }
    return encounter;
  }

  // Business mutations allow only a related non-voided Encounter belonging to the same Patient.
  private async lockAndRequireEligibleEncounter(
    tx: Transaction,
    organizationId: string,
    patientId: string,
    encounterId: string,
  ): Promise<EncounterLockRecord> {
    const encounter = await this.lockAndReadEncounter(tx, organizationId, patientId, encounterId);
    this.requireEligibleEncounter(encounter);
    return encounter;
  }

  // A completed task is historical; its source is checked only to take the lock, not to rewrite its status.
  private requireEligibleEncounter(encounter: EncounterLockRecord): void {
    if (encounter.status === ClinicalEncounterStatus.VOIDED) {
      throw this.conflict(
        'SOURCE_CLINICAL_ENCOUNTER_VOIDED',
        'The linked clinical encounter was voided',
      );
    }
    if (
      encounter.status !== ClinicalEncounterStatus.DRAFT &&
      encounter.status !== ClinicalEncounterStatus.FINALIZED
    ) {
      throw this.conflict('INVALID_FOLLOW_UP_STATE', 'The linked encounter cannot be used');
    }
  }

  // The task row is locked after its immutable Patient and optional source Encounter parents.
  private async lockFollowUp(
    tx: Transaction,
    organizationId: string,
    followUpId: string,
  ): Promise<void> {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "clinical_follow_ups"
      WHERE "id" = ${followUpId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  // Completion snapshots are protected from concurrent Owner edits and always use the required historical source.
  private async lockAndReadOwner(tx: Transaction, organizationId: string, ownerId: string) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "owners"
      WHERE "id" = ${ownerId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
    const owner = await tx.owner.findFirst({
      where: { id: ownerId, organizationId },
      select: { firstName: true, lastName: true },
    });
    if (!owner) throw this.notFound('OWNER_NOT_FOUND', 'Owner not found');
    return owner;
  }

  // Membership locks are sorted and deduplicated to give concurrent assignments one stable lock order.
  private async lockMemberships(
    tx: Transaction,
    organizationId: string,
    membershipIds: Array<string | null | undefined>,
  ): Promise<void> {
    for (const membershipId of uniqueSorted(membershipIds)) {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "memberships"
        WHERE "id" = ${membershipId}::uuid AND "organization_id" = ${organizationId}::uuid
        FOR UPDATE
      `);
    }
  }

  // Rechecks the actor under its row lock so a revoked or nonclinical membership cannot finish a write.
  private async requireClinicalActor(
    tx: Transaction,
    tenant: TenantContext,
    allowedRoles: ClinicalRole[],
  ) {
    const actor = await tx.membership.findFirst({
      where: {
        id: tenant.membershipId,
        organizationId: tenant.organizationId,
        status: MembershipStatus.ACTIVE,
        clinicalRole: { in: allowedRoles },
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        clinicalRole: true,
        professionalProfile: { select: { displayName: true, licenseNumber: true } },
      },
    });
    if (!actor)
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Clinical role required' });
    return actor;
  }

  // Assignment is operational and accepts only active clinical memberships in this tenant.
  private async requireAssignableMembership(
    tx: Transaction,
    organizationId: string,
    membershipId: string,
  ): Promise<void> {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        clinicalRole: { in: [ClinicalRole.PRACTITIONER, ClinicalRole.CLINICAL_ASSISTANT] },
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!membership) {
      throw this.notFound('ASSIGNED_MEMBERSHIP_NOT_FOUND', 'Clinical member not found');
    }
  }

  // Each lifecycle audit stores only operational transition data, never notes or clinical text.
  private async audit(
    tx: Transaction,
    tenant: TenantContext,
    entityId: string,
    action: 'FOLLOW_UP_CREATED' | 'FOLLOW_UP_UPDATED' | 'FOLLOW_UP_COMPLETED' | 'FOLLOW_UP_VOIDED',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await tx.clinicalAuditEvent.create({
      data: {
        organizationId: tenant.organizationId,
        actorMembershipId: tenant.membershipId,
        entityType: 'CLINICAL_FOLLOW_UP',
        entityId,
        action,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  // NOWAIT conflicts are retried outside the aborted transaction so Encounter-first writers can finish safely.
  private async transactionWithEncounterRetry<T>(operation: () => Promise<T>): Promise<T> {
    const delays = [20, 40, 80, 160];
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isLockUnavailable(error)) throw error;
        if (attempt === delays.length - 1) {
          throw this.conflict('FOLLOW_UP_BUSY', 'The linked clinical encounter is being updated');
        }
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }
    throw this.conflict('FOLLOW_UP_BUSY', 'The linked clinical encounter is being updated');
  }

  // An empty patch is rejected instead of producing a misleading version increase.
  private validateDateRange(dueFrom?: string, dueTo?: string): void {
    if (!dueFrom || !dueTo) return;
    if (parseCivilDate(dueFrom).getTime() > parseCivilDate(dueTo).getTime()) {
      throw this.badRequest('INVALID_DATE_RANGE', 'dueFrom must be on or before dueTo');
    }
  }

  // Public domain errors use stable codes and contain no SQL or Prisma details.
  private notFound(code: string, message: string): NotFoundException {
    return new NotFoundException({ code, message });
  }

  private conflict(code: string, message: string): ConflictException {
    return new ConflictException({ code, message });
  }

  private badRequest(code: string, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }

  private stale(): ConflictException {
    return this.conflict('FOLLOW_UP_STALE', 'Follow-up version is stale');
  }

  private immutable(): ConflictException {
    return this.conflict('FOLLOW_UP_IMMUTABLE', 'Completed or voided follow-ups are immutable');
  }

  private patientArchived(): ConflictException {
    return this.conflict('PATIENT_ARCHIVED', 'Archived patients cannot receive follow-up changes');
  }

  private requireText(value: string, code: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw this.badRequest(code, `${field} is required`);
    return trimmed;
  }
}

type EncounterLockRecord = {
  id: string;
  status: ClinicalEncounterStatus;
  ownerIdAtTime: string;
};

// Unique, sorted resource IDs make every multi-membership lock sequence deterministic.
function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

// Civil dates travel as UTC midnight solely for PostgreSQL DATE transport; no tenant timezone is applied.
function parseCivilDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match)
    throw new BadRequestException({ code: 'INVALID_CIVIL_DATE', message: 'Expected YYYY-MM-DD' });
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (
    year < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException({ code: 'INVALID_CIVIL_DATE', message: 'Invalid calendar date' });
  }
  return date;
}

// PostgreSQL DATE values are formatted using their UTC calendar fields to preserve exact civil dates.
function formatCivilDate(value: Date): string {
  return `${String(value.getUTCFullYear()).padStart(4, '0')}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

// Reminder instants must include an explicit offset and remain independent from dueOn.
function parseInstant(value: string): Date {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid reminder timestamp',
    });
  }
  return instant;
}

// Nullable free text is trimmed consistently on create, patch, completion and void.
function trimNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Dashboard civil-day comparisons use the Organization timezone, never the browser's timezone.
function civilDateInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

// Dashboard date windows are advanced in UTC calendar arithmetic to avoid daylight-saving shifts.
function addCivilDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// Prisma wraps NOWAIT SQLSTATE 55P03 as P2010; retries happen only for this exact contention case.
function isLockUnavailable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2010')
    return false;
  const meta = error.meta as { code?: string } | undefined;
  return meta?.code === '55P03';
}
