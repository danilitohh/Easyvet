import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ClinicalProcedureKind,
  ClinicalProcedureStatus,
  ClinicalRole,
  MembershipStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type {
  ClinicalProcedureDetail,
  ClinicalProcedureListResponse,
  ClinicalProcedureSummary,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  conflict,
  forbidden,
  lockEncounter,
  lockMembership,
  lockOwner,
  lockPatient,
  notFound,
  requireActivePatient,
  requireAnyPatient,
  requireEncounter,
  trimmedNullable,
  validation,
} from '../preventive-care/preventive-care.shared';
import {
  ClinicalProcedureListQueryDto,
  ClinicalProcedureVersionDto,
  CreateClinicalProcedureDto,
  UpdateClinicalProcedureDto,
  VoidClinicalProcedureDto,
} from './procedure.dto';

type DomainDatabase = PrismaService | Prisma.TransactionClient;
type EditableProcedureField =
  | 'procedureName'
  | 'performedAt'
  | 'indication'
  | 'description'
  | 'technique'
  | 'findings'
  | 'complications'
  | 'recoveryNotes'
  | 'postoperativePlan'
  | 'notes';
type EditableProcedureData = Partial<
  Pick<Prisma.ClinicalProcedureUncheckedCreateInput, EditableProcedureField>
>;

// One explicit select defines the safe, tenant-scoped response shape for every read path.
const procedureSelect = {
  id: true,
  organizationId: true,
  clinicalEncounterId: true,
  patientId: true,
  kind: true,
  status: true,
  version: true,
  procedureName: true,
  performedAt: true,
  indication: true,
  description: true,
  technique: true,
  findings: true,
  complications: true,
  recoveryNotes: true,
  postoperativePlan: true,
  notes: true,
  createdByMembershipId: true,
  responsiblePractitionerMembershipId: true,
  patientNameSnapshot: true,
  ownerDisplayNameSnapshot: true,
  professionalDisplayNameSnapshot: true,
  professionalLicenseSnapshot: true,
  finalizedAt: true,
  finalizedByMembershipId: true,
  voidedAt: true,
  voidedByMembershipId: true,
  voidReason: true,
  createdAt: true,
  updatedAt: true,
  patient: { select: { id: true, name: true, status: true } },
  clinicalEncounter: { select: { id: true, status: true } },
  responsiblePractitionerMembership: {
    select: {
      id: true,
      clinicalRole: true,
      professionalProfile: { select: { displayName: true, licenseNumber: true } },
    },
  },
  surgeryDetail: {
    select: {
      id: true,
      organizationId: true,
      clinicalProcedureId: true,
      assistantMembershipId: true,
      assistantDisplayNameSnapshot: true,
      surgicalArea: true,
      surgicalSide: true,
      bleedingNotes: true,
      closureNotes: true,
      createdAt: true,
      updatedAt: true,
      assistantMembership: {
        select: {
          id: true,
          clinicalRole: true,
          professionalProfile: { select: { displayName: true, licenseNumber: true } },
        },
      },
    },
  },
} satisfies Prisma.ClinicalProcedureSelect;

type ProcedureRecord = Prisma.ClinicalProcedureGetPayload<{ select: typeof procedureSelect }>;

const editableFields: EditableProcedureField[] = [
  'procedureName',
  'performedAt',
  'indication',
  'description',
  'technique',
  'findings',
  'complications',
  'recoveryNotes',
  'postoperativePlan',
  'notes',
];

// Optional narrative strings are trimmed and blank content is represented as null, never truncated.
function normalizeText(value: string | null | undefined): string | null | undefined {
  return trimmedNullable(value);
}

// Date input must be an ISO timestamp with an explicit UTC offset to avoid server-local interpretation.
function normalizeDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'performedAt must include an explicit timezone offset',
    });
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'performedAt is invalid' });
  }
  return date;
}

// The service owns tenant isolation, lifecycle transitions, snapshots, auditing, and locking.
@Injectable()
export class ProceduresService {
  constructor(private readonly prisma: PrismaService) {}

  // Patient history retains drafts without performedAt unless a date filter is requested.
  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: ClinicalProcedureListQueryDto,
  ): Promise<ClinicalProcedureListResponse> {
    await requireAnyPatient(this.prisma, tenant.organizationId, patientId);
    const from = query.from ? normalizeDate(query.from) : undefined;
    const to = query.to ? normalizeDate(query.to) : undefined;
    if (from && to && from > to) {
      throw validation('INVALID_DATE_RANGE', 'from must be on or before to');
    }
    const where: Prisma.ClinicalProcedureWhereInput = {
      organizationId: tenant.organizationId,
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.clinicalEncounterId ? { clinicalEncounterId: query.clinicalEncounterId } : {}),
      ...(from || to
        ? { performedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.clinicalProcedure.findMany({
        where,
        select: procedureSelect,
        orderBy: [
          { performedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.clinicalProcedure.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toSummary(row)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  // A tenant-qualified lookup prevents cross-organization IDs from revealing resource existence.
  async findOne(tenant: TenantContext, procedureId: string): Promise<ClinicalProcedureDetail> {
    const procedure = await this.prisma.clinicalProcedure.findFirst({
      where: { id: procedureId, organizationId: tenant.organizationId },
      select: procedureSelect,
    });
    if (!procedure) throw notFound('PROCEDURE_NOT_FOUND', 'Clinical procedure not found');
    return this.toDetail(procedure);
  }

  // Creation locks Encounter then Patient so concurrent parent void/archive operations serialize safely.
  async create(
    tenant: TenantContext,
    encounterId: string,
    input: CreateClinicalProcedureDto,
  ): Promise<ClinicalProcedureDetail> {
    const createdId = await this.prisma.$transaction(async (tx) => {
      await lockEncounter(tx, tenant.organizationId, encounterId);
      const encounter = await requireEncounter(tx, tenant.organizationId, encounterId);
      await lockPatient(tx, tenant.organizationId, encounter.patientId);
      await requireActivePatient(tx, tenant.organizationId, encounter.patientId);
      if (input.kind === ClinicalProcedureKind.PROCEDURE && input.surgeryDetail) {
        throw conflict(
          'SURGERY_DETAIL_NOT_ALLOWED',
          'Procedure kind cannot contain surgery details',
        );
      }
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        ...(input.responsiblePractitionerMembershipId
          ? [input.responsiblePractitionerMembershipId]
          : []),
        ...(input.kind === ClinicalProcedureKind.SURGERY &&
        input.surgeryDetail?.assistantMembershipId
          ? [input.surgeryDetail.assistantMembershipId]
          : []),
      ]);
      await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);
      if (input.responsiblePractitionerMembershipId) {
        await this.requirePractitioner(
          tx,
          tenant.organizationId,
          input.responsiblePractitionerMembershipId,
        );
      }
      const created = await tx.clinicalProcedure.create({
        data: {
          organizationId: tenant.organizationId,
          clinicalEncounterId: encounterId,
          patientId: encounter.patientId,
          kind: input.kind,
          ...this.editableData(input),
          createdByMembershipId: tenant.membershipId,
          responsiblePractitionerMembershipId: input.responsiblePractitionerMembershipId ?? null,
        },
        select: { id: true },
      });
      if (input.kind === ClinicalProcedureKind.SURGERY && input.surgeryDetail) {
        const detail = this.normalizeSurgeryDetail(input.surgeryDetail, null);
        if (detail.assistantMembershipId) {
          await this.requireAssistant(tx, tenant.organizationId, detail.assistantMembershipId);
        }
        await tx.clinicalSurgeryDetail.create({
          data: {
            organizationId: tenant.organizationId,
            clinicalProcedureId: created.id,
            ...detail,
          },
        });
      }
      await this.createAudit(tx, tenant, created.id, 'CREATED', {
        kind: input.kind,
        newVersion: 1,
      });
      return created.id;
    });
    return this.findOne(tenant, createdId);
  }

  // Draft edits update parent version and surgery child atomically and reject stale/no-op patches.
  async updateDraft(
    tenant: TenantContext,
    procedureId: string,
    input: UpdateClinicalProcedureDto,
  ): Promise<ClinicalProcedureDetail> {
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireProcedure(tx, tenant.organizationId, procedureId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockProcedure(tx, tenant.organizationId, procedureId);
      const current = await this.requireProcedure(tx, tenant.organizationId, procedureId);
      this.assertExpectedVersion(current, input.expectedVersion);
      if (current.status !== ClinicalProcedureStatus.DRAFT) {
        throw conflict('PROCEDURE_IMMUTABLE', 'Only draft procedures can be edited');
      }
      await requireEncounter(tx, tenant.organizationId, current.clinicalEncounterId);
      await requireActivePatient(tx, tenant.organizationId, current.patientId);
      const kind = input.kind ?? current.kind;
      if (kind === ClinicalProcedureKind.PROCEDURE && input.surgeryDetail) {
        throw conflict(
          'SURGERY_DETAIL_NOT_ALLOWED',
          'Procedure kind cannot contain surgery details',
        );
      }
      const detailData =
        input.surgeryDetail && kind === ClinicalProcedureKind.SURGERY
          ? this.normalizeSurgeryDetail(input.surgeryDetail, current.surgeryDetail)
          : undefined;
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        ...(input.responsiblePractitionerMembershipId
          ? [input.responsiblePractitionerMembershipId]
          : []),
        ...(detailData?.assistantMembershipId ? [detailData.assistantMembershipId] : []),
      ]);
      await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);
      if (input.responsiblePractitionerMembershipId) {
        await this.requirePractitioner(
          tx,
          tenant.organizationId,
          input.responsiblePractitionerMembershipId,
        );
      }

      const data = this.editableData(input);
      const changedFieldNames: string[] = [];
      if (kind !== current.kind) changedFieldNames.push('kind');
      for (const key of editableFields) {
        if (data[key] !== undefined && !this.sameValue(data[key], current[key])) {
          changedFieldNames.push(key);
        }
      }
      if (
        input.responsiblePractitionerMembershipId !== undefined &&
        input.responsiblePractitionerMembershipId !== current.responsiblePractitionerMembershipId
      ) {
        changedFieldNames.push('responsiblePractitionerMembershipId');
      }

      const existingDetail = current.surgeryDetail;
      const deleteDetail = kind === ClinicalProcedureKind.PROCEDURE && existingDetail !== null;
      if (detailData) {
        if (detailData.assistantMembershipId) {
          await this.requireAssistant(tx, tenant.organizationId, detailData.assistantMembershipId);
        }
        if (!this.sameDetail(detailData, existingDetail)) changedFieldNames.push('surgeryDetail');
      } else if (input.surgeryDetail === null && existingDetail) {
        changedFieldNames.push('surgeryDetail');
      }
      if (deleteDetail) changedFieldNames.push('surgeryDetail');
      if (changedFieldNames.length === 0) {
        throw conflict('PROCEDURE_NO_CHANGES', 'The draft update contains no changes');
      }

      const result = await tx.clinicalProcedure.updateMany({
        where: {
          id: procedureId,
          organizationId: tenant.organizationId,
          status: ClinicalProcedureStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          ...data,
          ...(kind !== current.kind ? { kind } : {}),
          ...(input.responsiblePractitionerMembershipId !== undefined
            ? { responsiblePractitionerMembershipId: input.responsiblePractitionerMembershipId }
            : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw conflict('PROCEDURE_STALE', 'Clinical procedure version is stale');
      if (deleteDetail || input.surgeryDetail === null) {
        await tx.clinicalSurgeryDetail.deleteMany({
          where: { clinicalProcedureId: procedureId, organizationId: tenant.organizationId },
        });
      } else if (detailData) {
        await tx.clinicalSurgeryDetail.upsert({
          where: {
            clinicalProcedureId_organizationId: {
              clinicalProcedureId: procedureId,
              organizationId: tenant.organizationId,
            },
          },
          create: {
            organizationId: tenant.organizationId,
            clinicalProcedureId: procedureId,
            ...detailData,
          },
          update: detailData,
        });
      }
      await this.createAudit(tx, tenant, procedureId, 'UPDATED', {
        changedFieldNames,
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, procedureId);
  }

  // Finalization snapshots the historical owner and locked membership profiles in one transaction.
  async finalize(
    tenant: TenantContext,
    procedureId: string,
    input: ClinicalProcedureVersionDto,
  ): Promise<ClinicalProcedureDetail> {
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireProcedure(tx, tenant.organizationId, procedureId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockProcedure(tx, tenant.organizationId, procedureId);
      const current = await this.requireProcedure(tx, tenant.organizationId, procedureId);
      this.assertExpectedVersion(current, input.expectedVersion);
      if (current.status !== ClinicalProcedureStatus.DRAFT) {
        throw conflict('INVALID_PROCEDURE_STATE', 'Only draft procedures can be finalized');
      }
      const encounter = await requireEncounter(
        tx,
        tenant.organizationId,
        current.clinicalEncounterId,
      );
      const patient = await requireActivePatient(tx, tenant.organizationId, current.patientId);
      const procedureName = current.procedureName?.trim();
      if (!procedureName) throw conflict('PROCEDURE_NAME_REQUIRED', 'Procedure name is required');
      if (!current.performedAt) {
        throw conflict('PROCEDURE_PERFORMED_AT_REQUIRED', 'Procedure performedAt is required');
      }
      const responsibleId = current.responsiblePractitionerMembershipId;
      if (!responsibleId) {
        throw conflict(
          'RESPONSIBLE_PRACTITIONER_REQUIRED',
          'A responsible practitioner is required',
        );
      }
      if (tenant.membershipId !== responsibleId) {
        throw forbidden(
          'ONLY_RESPONSIBLE_PRACTITIONER_CAN_FINALIZE',
          'Only the responsible practitioner can finalize this procedure',
        );
      }
      const assistantId = current.surgeryDetail?.assistantMembershipId ?? null;
      await lockOwner(tx, tenant.organizationId, encounter.ownerIdAtTime);
      await this.lockMemberships(tx, tenant.organizationId, [
        responsibleId,
        ...(assistantId ? [assistantId] : []),
      ]);
      const responsible = await this.requirePractitioner(tx, tenant.organizationId, responsibleId);
      const professionalDisplayName = responsible.professionalProfile?.displayName.trim();
      if (!professionalDisplayName) {
        throw conflict('PROFESSIONAL_PROFILE_REQUIRED', 'Professional display name is required');
      }
      let assistantDisplayName: string | null = null;
      if (assistantId) {
        const assistant = await this.requireAssistant(tx, tenant.organizationId, assistantId);
        assistantDisplayName = assistant.professionalProfile?.displayName.trim() || null;
        if (!assistantDisplayName) {
          throw conflict(
            'ASSISTANT_PROFILE_REQUIRED',
            'Assigned assistant needs a professional profile',
          );
        }
      }
      const owner = await tx.owner.findFirst({
        where: { id: encounter.ownerIdAtTime, organizationId: tenant.organizationId },
        select: { firstName: true, lastName: true },
      });
      if (!owner) throw notFound('OWNER_NOT_FOUND', 'Historical encounter owner not found');
      const updated = await tx.clinicalProcedure.updateMany({
        where: {
          id: procedureId,
          organizationId: tenant.organizationId,
          status: ClinicalProcedureStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          status: ClinicalProcedureStatus.FINALIZED,
          version: { increment: 1 },
          procedureName,
          patientNameSnapshot: patient.name,
          ownerDisplayNameSnapshot: `${owner.firstName} ${owner.lastName ?? ''}`.trim(),
          professionalDisplayNameSnapshot: professionalDisplayName,
          professionalLicenseSnapshot:
            normalizeText(responsible.professionalProfile?.licenseNumber) ?? null,
          finalizedAt: new Date(),
          finalizedByMembershipId: tenant.membershipId,
        },
      });
      if (updated.count !== 1)
        throw conflict('PROCEDURE_STALE', 'Clinical procedure version is stale');
      if (current.surgeryDetail) {
        await tx.clinicalSurgeryDetail.updateMany({
          where: { clinicalProcedureId: procedureId, organizationId: tenant.organizationId },
          data: { assistantDisplayNameSnapshot: assistantDisplayName },
        });
      }
      await this.createAudit(tx, tenant, procedureId, 'FINALIZED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, procedureId);
  }

  // Void preserves finalized content and allows an archived Patient or voided parent Encounter.
  async void(
    tenant: TenantContext,
    procedureId: string,
    input: VoidClinicalProcedureDto,
  ): Promise<ClinicalProcedureDetail> {
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireProcedure(tx, tenant.organizationId, procedureId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockProcedure(tx, tenant.organizationId, procedureId);
      const current = await this.requireProcedure(tx, tenant.organizationId, procedureId);
      this.assertExpectedVersion(current, input.expectedVersion);
      if (current.status !== ClinicalProcedureStatus.FINALIZED) {
        throw conflict('INVALID_PROCEDURE_STATE', 'Only finalized procedures can be voided');
      }
      const encounter = await tx.clinicalEncounter.findFirst({
        where: { id: current.clinicalEncounterId, organizationId: tenant.organizationId },
        select: { ownerIdAtTime: true },
      });
      if (!encounter)
        throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
      await lockOwner(tx, tenant.organizationId, encounter.ownerIdAtTime);
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requirePractitioner(tx, tenant.organizationId, tenant.membershipId);
      const reason = input.reason.trim();
      if (!reason) throw validation('VOID_REASON_REQUIRED', 'Void reason is required');
      const updated = await tx.clinicalProcedure.updateMany({
        where: {
          id: procedureId,
          organizationId: tenant.organizationId,
          status: ClinicalProcedureStatus.FINALIZED,
          version: input.expectedVersion,
        },
        data: {
          status: ClinicalProcedureStatus.VOIDED,
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw conflict('PROCEDURE_STALE', 'Clinical procedure version is stale');
      await this.createAudit(tx, tenant, procedureId, 'VOIDED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, procedureId);
  }

  // Builds updates from explicitly supplied fields so omitted values remain unchanged.
  private editableData(input: CreateClinicalProcedureDto | UpdateClinicalProcedureDto) {
    const data: EditableProcedureData = {};
    for (const key of editableFields) {
      const value = input[key];
      if (value === undefined) continue;
      (data as Record<string, unknown>)[key] =
        key === 'performedAt'
          ? normalizeDate(value as string | null)
          : normalizeText(value as string | null);
    }
    return data;
  }

  // Normalizes surgery child fields while preserving values omitted from a partial update.
  private normalizeSurgeryDetail(
    input: NonNullable<CreateClinicalProcedureDto['surgeryDetail']>,
    current: ProcedureRecord['surgeryDetail'],
  ) {
    return {
      assistantMembershipId:
        input.assistantMembershipId === undefined
          ? (current?.assistantMembershipId ?? null)
          : input.assistantMembershipId,
      assistantDisplayNameSnapshot: null,
      surgicalArea:
        input.surgicalArea === undefined
          ? (current?.surgicalArea ?? null)
          : (normalizeText(input.surgicalArea) ?? null),
      surgicalSide:
        input.surgicalSide === undefined
          ? (current?.surgicalSide ?? null)
          : (normalizeText(input.surgicalSide) ?? null),
      bleedingNotes:
        input.bleedingNotes === undefined
          ? (current?.bleedingNotes ?? null)
          : (normalizeText(input.bleedingNotes) ?? null),
      closureNotes:
        input.closureNotes === undefined
          ? (current?.closureNotes ?? null)
          : (normalizeText(input.closureNotes) ?? null),
    };
  }

  // Child comparisons exclude timestamps and snapshots that are populated only during finalization.
  private sameDetail(
    left: ReturnType<ProceduresService['normalizeSurgeryDetail']>,
    right: ProcedureRecord['surgeryDetail'],
  ): boolean {
    return Boolean(
      right &&
      left.assistantMembershipId === right.assistantMembershipId &&
      left.surgicalArea === right.surgicalArea &&
      left.surgicalSide === right.surgicalSide &&
      left.bleedingNotes === right.bleedingNotes &&
      left.closureNotes === right.closureNotes,
    );
  }

  // Eligibility is checked in the transaction, not inferred from a display role or caller-provided data.
  private async requirePractitioner(
    database: DomainDatabase,
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await database.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        clinicalRole: ClinicalRole.PRACTITIONER,
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        clinicalRole: true,
        professionalProfile: { select: { displayName: true, licenseNumber: true } },
      },
    });
    if (!membership) {
      throw conflict('RESPONSIBLE_PRACTITIONER_REQUIRED', 'An active practitioner is required');
    }
    return membership;
  }

  // The caller's tenant membership is rechecked after its row lock to close authorization races.
  private async requireActiveActor(
    database: DomainDatabase,
    organizationId: string,
    membershipId: string,
  ): Promise<void> {
    const membership = await database.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!membership) {
      throw forbidden('INSUFFICIENT_PERMISSION', 'An active tenant membership is required');
    }
  }

  // Assistants are limited to active practitioner/clinical-assistant memberships in the same tenant.
  private async requireAssistant(
    database: DomainDatabase,
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await database.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        clinicalRole: { in: [ClinicalRole.PRACTITIONER, ClinicalRole.CLINICAL_ASSISTANT] },
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        clinicalRole: true,
        professionalProfile: { select: { displayName: true, licenseNumber: true } },
      },
    });
    if (!membership) {
      throw conflict(
        'ASSISTANT_PROFILE_REQUIRED',
        'An active clinical assistant or practitioner is required',
      );
    }
    return membership;
  }

  // Locks sorted, deduplicated membership IDs to keep finalization lock order deterministic.
  private async lockMemberships(
    database: DomainDatabase,
    organizationId: string,
    membershipIds: string[],
  ): Promise<void> {
    for (const membershipId of [...new Set(membershipIds)].sort()) {
      await lockMembership(database, organizationId, membershipId);
    }
  }

  // Lock one child row after its parent Encounter and Patient have been locked.
  private async lockProcedure(
    database: DomainDatabase,
    organizationId: string,
    procedureId: string,
  ): Promise<void> {
    await database.$queryRaw(Prisma.sql`
      SELECT "id" FROM "clinical_procedures"
      WHERE "id" = ${procedureId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  // Tenant-qualified lookups avoid disclosing whether a foreign organization owns an ID.
  private async requireProcedure(
    database: DomainDatabase,
    organizationId: string,
    procedureId: string,
  ): Promise<ProcedureRecord> {
    const procedure = await database.clinicalProcedure.findFirst({
      where: { id: procedureId, organizationId },
      select: procedureSelect,
    });
    if (!procedure) throw notFound('PROCEDURE_NOT_FOUND', 'Clinical procedure not found');
    return procedure;
  }

  // A version mismatch wins over terminal-state errors so concurrent losers receive a stable 409.
  private assertExpectedVersion(procedure: ProcedureRecord, expectedVersion: number): void {
    if (procedure.version !== expectedVersion) {
      throw conflict('PROCEDURE_STALE', 'Clinical procedure version is stale');
    }
  }

  // Compares normalized values and exact instant timestamps for no-op detection.
  private sameValue(left: unknown, right: unknown): boolean {
    if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
    return left === right;
  }

  // Audit metadata carries only lifecycle/version information and field names, never clinical values.
  private async createAudit(
    database: Prisma.TransactionClient,
    tenant: TenantContext,
    entityId: string,
    action: 'CREATED' | 'UPDATED' | 'FINALIZED' | 'VOIDED',
    metadata: Record<string, string | number | string[]>,
  ): Promise<void> {
    await database.clinicalAuditEvent.create({
      data: {
        organizationId: tenant.organizationId,
        actorMembershipId: tenant.membershipId,
        entityType: 'CLINICAL_PROCEDURE',
        entityId,
        action,
        metadata,
      },
    });
  }

  // Summary responses omit narrative content while retaining state, snapshots and parent context.
  private toSummary(record: ProcedureRecord): ClinicalProcedureSummary {
    return {
      id: record.id,
      organizationId: record.organizationId,
      clinicalEncounterId: record.clinicalEncounterId,
      patientId: record.patientId,
      kind: record.kind,
      status: record.status,
      version: record.version,
      procedureName: record.procedureName,
      performedAt: record.performedAt?.toISOString() ?? null,
      responsiblePractitionerMembershipId: record.responsiblePractitionerMembershipId,
      patientNameSnapshot: record.patientNameSnapshot,
      ownerDisplayNameSnapshot: record.ownerDisplayNameSnapshot,
      professionalDisplayNameSnapshot: record.professionalDisplayNameSnapshot,
      professionalLicenseSnapshot: record.professionalLicenseSnapshot,
      finalizedAt: record.finalizedAt?.toISOString() ?? null,
      voidedAt: record.voidedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      parentEncounterStatus: record.clinicalEncounter.status,
      patient: record.patient,
      encounter: record.clinicalEncounter,
      responsiblePractitioner: record.responsiblePractitionerMembership
        ? this.toMembershipSummary(record.responsiblePractitionerMembership)
        : null,
    };
  }

  // Detailed reads include all permitted narrative fields and the optional surgical child aggregate.
  private toDetail(record: ProcedureRecord): ClinicalProcedureDetail {
    return {
      ...this.toSummary(record),
      indication: record.indication,
      description: record.description,
      technique: record.technique,
      findings: record.findings,
      complications: record.complications,
      recoveryNotes: record.recoveryNotes,
      postoperativePlan: record.postoperativePlan,
      notes: record.notes,
      createdByMembershipId: record.createdByMembershipId,
      finalizedByMembershipId: record.finalizedByMembershipId,
      voidedByMembershipId: record.voidedByMembershipId,
      voidReason: record.voidReason,
      surgeryDetail: record.surgeryDetail
        ? {
            id: record.surgeryDetail.id,
            organizationId: record.surgeryDetail.organizationId,
            clinicalProcedureId: record.surgeryDetail.clinicalProcedureId,
            assistantMembershipId: record.surgeryDetail.assistantMembershipId,
            assistantDisplayNameSnapshot: record.surgeryDetail.assistantDisplayNameSnapshot,
            surgicalArea: record.surgeryDetail.surgicalArea,
            surgicalSide: record.surgeryDetail.surgicalSide,
            bleedingNotes: record.surgeryDetail.bleedingNotes,
            closureNotes: record.surgeryDetail.closureNotes,
            createdAt: record.surgeryDetail.createdAt.toISOString(),
            updatedAt: record.surgeryDetail.updatedAt.toISOString(),
            assistant: record.surgeryDetail.assistantMembership
              ? this.toMembershipSummary(record.surgeryDetail.assistantMembership)
              : null,
          }
        : null,
    };
  }

  // Profile data is contextual; immutable clinical snapshots remain separate from current values.
  private toMembershipSummary(membership: {
    id: string;
    clinicalRole: ClinicalRole | null;
    professionalProfile: { displayName: string; licenseNumber: string | null } | null;
  }) {
    return {
      membershipId: membership.id,
      displayName: membership.professionalProfile?.displayName ?? null,
      licenseNumber: membership.professionalProfile?.licenseNumber ?? null,
      clinicalRole: membership.clinicalRole,
    };
  }

  // Pagination matches the bounded structure used by other clinical history endpoints.
  private pagination(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) };
  }
}
