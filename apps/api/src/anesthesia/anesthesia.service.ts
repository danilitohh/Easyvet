import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AnesthesiaRecordStatus,
  ClinicalProcedureStatus,
  ClinicalRole,
  MembershipStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type {
  AnesthesiaObservation,
  AnesthesiaObservationListResponse,
  AnesthesiaObservationMutationResponse,
  AnesthesiaRecordDetail,
  AnesthesiaRecordListResponse,
  AnesthesiaRecordSummary,
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
  AnesthesiaObservationListQueryDto,
  AnesthesiaRecordListQueryDto,
  AnesthesiaRecordVersionDto,
  CreateAnesthesiaObservationDto,
  CreateAnesthesiaRecordDto,
  RemoveAnesthesiaObservationQueryDto,
  UpdateAnesthesiaObservationDto,
  UpdateAnesthesiaRecordDto,
  VoidAnesthesiaRecordDto,
} from './anesthesia.dto';

type DomainDatabase = PrismaService | Prisma.TransactionClient;
type EditableAnesthesiaField =
  | 'clinicalProcedureId'
  | 'startedAt'
  | 'endedAt'
  | 'asaClassification'
  | 'technique'
  | 'preAnestheticAssessment'
  | 'medicationsText'
  | 'airwayManagement'
  | 'fluidsText'
  | 'complications'
  | 'recoveryNotes'
  | 'notes'
  | 'responsiblePractitionerMembershipId';
type EditableObservationField =
  | 'observedAt'
  | 'heartRateBpm'
  | 'respiratoryRatePerMinute'
  | 'temperatureC'
  | 'bloodPressureText'
  | 'spo2Percent'
  | 'etco2MmHg'
  | 'anestheticPlane'
  | 'notes';
type EditableAnesthesiaData = Partial<{
  clinicalProcedureId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  asaClassification: string | null;
  technique: string | null;
  preAnestheticAssessment: string | null;
  medicationsText: string | null;
  airwayManagement: string | null;
  fluidsText: string | null;
  complications: string | null;
  recoveryNotes: string | null;
  notes: string | null;
  responsiblePractitionerMembershipId: string | null;
}>;
type ObservationMutationData = Partial<{
  observedAt: Date;
  heartRateBpm: number | null;
  respiratoryRatePerMinute: number | null;
  temperatureC: number | Prisma.Decimal | null;
  bloodPressureText: string | null;
  spo2Percent: number | Prisma.Decimal | null;
  etco2MmHg: number | Prisma.Decimal | null;
  anestheticPlane: string | null;
  notes: string | null;
}>;

const anesthesiaSelect = {
  id: true,
  organizationId: true,
  clinicalEncounterId: true,
  clinicalProcedureId: true,
  patientId: true,
  status: true,
  version: true,
  startedAt: true,
  endedAt: true,
  asaClassification: true,
  technique: true,
  preAnestheticAssessment: true,
  medicationsText: true,
  airwayManagement: true,
  fluidsText: true,
  complications: true,
  recoveryNotes: true,
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
  clinicalProcedure: { select: { id: true, kind: true, status: true, procedureName: true } },
  responsiblePractitionerMembership: {
    select: {
      id: true,
      clinicalRole: true,
      professionalProfile: { select: { displayName: true, licenseNumber: true } },
    },
  },
  _count: { select: { observations: true } },
} satisfies Prisma.AnesthesiaRecordSelect;

const observationSelect = {
  id: true,
  organizationId: true,
  anesthesiaRecordId: true,
  observedAt: true,
  heartRateBpm: true,
  respiratoryRatePerMinute: true,
  temperatureC: true,
  bloodPressureText: true,
  spo2Percent: true,
  etco2MmHg: true,
  anestheticPlane: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AnesthesiaObservationSelect;

type AnesthesiaRecordEntity = Prisma.AnesthesiaRecordGetPayload<{
  select: typeof anesthesiaSelect;
}>;
type ObservationEntity = Prisma.AnesthesiaObservationGetPayload<{
  select: typeof observationSelect;
}>;

const editableAnesthesiaFields: EditableAnesthesiaField[] = [
  'clinicalProcedureId',
  'startedAt',
  'endedAt',
  'asaClassification',
  'technique',
  'preAnestheticAssessment',
  'medicationsText',
  'airwayManagement',
  'fluidsText',
  'complications',
  'recoveryNotes',
  'notes',
  'responsiblePractitionerMembershipId',
];
const editableObservationFields: EditableObservationField[] = [
  'observedAt',
  'heartRateBpm',
  'respiratoryRatePerMinute',
  'temperatureC',
  'bloodPressureText',
  'spo2Percent',
  'etco2MmHg',
  'anestheticPlane',
  'notes',
];

function normalizeText(value: string | null | undefined): string | null | undefined {
  return trimmedNullable(value);
}

function normalizeDate(value: string | null | undefined, field: string): Date | null | undefined {
  if (value === undefined || value === null) return value;
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must include an explicit timezone offset`,
    });
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${field} is invalid` });
  }
  return date;
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

@Injectable()
export class AnesthesiaService {
  constructor(private readonly prisma: PrismaService) {}

  // Patient history keeps observation payloads paged separately from anesthesia summaries.
  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: AnesthesiaRecordListQueryDto,
  ): Promise<AnesthesiaRecordListResponse> {
    await requireAnyPatient(this.prisma, tenant.organizationId, patientId);
    const from = query.from ? normalizeDate(query.from, 'from') : undefined;
    const to = query.to ? normalizeDate(query.to, 'to') : undefined;
    if (from && to && from > to) {
      throw validation('INVALID_DATE_RANGE', 'from must be on or before to');
    }
    const where: Prisma.AnesthesiaRecordWhereInput = {
      organizationId: tenant.organizationId,
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clinicalEncounterId ? { clinicalEncounterId: query.clinicalEncounterId } : {}),
      ...(query.clinicalProcedureId ? { clinicalProcedureId: query.clinicalProcedureId } : {}),
      ...(from || to
        ? { startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.anesthesiaRecord.findMany({
        where,
        select: anesthesiaSelect,
        orderBy: [
          { startedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.anesthesiaRecord.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toSummary(row)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  async findOne(
    tenant: TenantContext,
    anesthesiaRecordId: string,
  ): Promise<AnesthesiaRecordDetail> {
    const record = await this.prisma.anesthesiaRecord.findFirst({
      where: { id: anesthesiaRecordId, organizationId: tenant.organizationId },
      select: anesthesiaSelect,
    });
    if (!record) throw notFound('ANESTHESIA_NOT_FOUND', 'Anesthesia record not found');
    return this.toDetail(record);
  }

  async create(
    tenant: TenantContext,
    encounterId: string,
    input: CreateAnesthesiaRecordDto,
  ): Promise<AnesthesiaRecordDetail> {
    const createdId = await this.prisma.$transaction(async (tx) => {
      await lockEncounter(tx, tenant.organizationId, encounterId);
      const encounter = await requireEncounter(tx, tenant.organizationId, encounterId);
      await lockPatient(tx, tenant.organizationId, encounter.patientId);
      await requireActivePatient(tx, tenant.organizationId, encounter.patientId);
      if (input.clinicalProcedureId) {
        await this.lockProcedure(tx, tenant.organizationId, input.clinicalProcedureId);
        await this.requireEligibleProcedure(
          tx,
          tenant.organizationId,
          encounter.patientId,
          encounterId,
          input.clinicalProcedureId,
        );
      }
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        ...(input.responsiblePractitionerMembershipId
          ? [input.responsiblePractitionerMembershipId]
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
      const data = this.editableAnesthesiaData(input);
      this.assertTimeRange(data.startedAt ?? null, data.endedAt ?? null);
      const created = await tx.anesthesiaRecord.create({
        data: {
          organizationId: tenant.organizationId,
          clinicalEncounterId: encounterId,
          patientId: encounter.patientId,
          ...data,
          createdByMembershipId: tenant.membershipId,
        },
        select: { id: true },
      });
      await this.createAudit(tx, tenant, created.id, 'CREATED', { newVersion: 1 });
      return created.id;
    });
    return this.findOne(tenant, createdId);
  }

  // Draft edits lock old and new Procedure links in ID order so relinks cannot deadlock with voids.
  async updateDraft(
    tenant: TenantContext,
    anesthesiaRecordId: string,
    input: UpdateAnesthesiaRecordDto,
  ): Promise<AnesthesiaRecordDetail> {
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireRecord(tx, tenant.organizationId, anesthesiaRecordId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      const nextProcedureId =
        input.clinicalProcedureId === undefined
          ? snapshot.clinicalProcedureId
          : input.clinicalProcedureId;
      await this.lockProcedures(tx, tenant.organizationId, [
        snapshot.clinicalProcedureId,
        nextProcedureId,
      ]);
      await this.lockRecord(tx, tenant.organizationId, anesthesiaRecordId);
      const current = await this.requireRecord(tx, tenant.organizationId, anesthesiaRecordId);
      this.assertExpectedVersion(current, input.expectedVersion);
      if (current.status !== AnesthesiaRecordStatus.DRAFT) {
        throw conflict('ANESTHESIA_IMMUTABLE', 'Only draft anesthesia records can be edited');
      }
      await requireEncounter(tx, tenant.organizationId, current.clinicalEncounterId);
      await requireActivePatient(tx, tenant.organizationId, current.patientId);
      const procedureLinkChanged =
        input.clinicalProcedureId !== undefined &&
        input.clinicalProcedureId !== current.clinicalProcedureId;
      if (current.clinicalProcedureId && !procedureLinkChanged) {
        await this.requireEligibleProcedure(
          tx,
          tenant.organizationId,
          current.patientId,
          current.clinicalEncounterId,
          current.clinicalProcedureId,
        );
      }
      if (nextProcedureId) {
        await this.requireEligibleProcedure(
          tx,
          tenant.organizationId,
          current.patientId,
          current.clinicalEncounterId,
          nextProcedureId,
        );
      }
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        ...(input.responsiblePractitionerMembershipId
          ? [input.responsiblePractitionerMembershipId]
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
      const data = this.editableAnesthesiaData(input);
      const candidateStartedAt = data.startedAt === undefined ? current.startedAt : data.startedAt;
      const candidateEndedAt = data.endedAt === undefined ? current.endedAt : data.endedAt;
      this.assertTimeRange(candidateStartedAt, candidateEndedAt);
      const changedFieldNames = this.changedAnesthesiaFields(current, data);
      if (changedFieldNames.length === 0) {
        throw conflict('ANESTHESIA_NO_CHANGES', 'The draft update contains no changes');
      }
      const updated = await tx.anesthesiaRecord.updateMany({
        where: {
          id: anesthesiaRecordId,
          organizationId: tenant.organizationId,
          status: AnesthesiaRecordStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw conflict('ANESTHESIA_STALE', 'Anesthesia version is stale');
      await this.createAudit(tx, tenant, anesthesiaRecordId, 'UPDATED', {
        changedFieldNames,
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, anesthesiaRecordId);
  }

  // Finalization snapshots Patient, historical Owner and responsible practitioner in one transaction.
  async finalize(
    tenant: TenantContext,
    anesthesiaRecordId: string,
    input: AnesthesiaRecordVersionDto,
  ): Promise<AnesthesiaRecordDetail> {
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireRecord(tx, tenant.organizationId, anesthesiaRecordId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockProcedures(tx, tenant.organizationId, [snapshot.clinicalProcedureId]);
      await this.lockRecord(tx, tenant.organizationId, anesthesiaRecordId);
      const current = await this.requireRecord(tx, tenant.organizationId, anesthesiaRecordId);
      this.assertExpectedVersion(current, input.expectedVersion);
      if (current.status !== AnesthesiaRecordStatus.DRAFT) {
        throw conflict('INVALID_ANESTHESIA_STATE', 'Only draft anesthesia records can finalize');
      }
      const encounter = await requireEncounter(
        tx,
        tenant.organizationId,
        current.clinicalEncounterId,
      );
      const patient = await requireActivePatient(tx, tenant.organizationId, current.patientId);
      if (current.clinicalProcedureId) {
        await this.requireEligibleProcedure(
          tx,
          tenant.organizationId,
          current.patientId,
          current.clinicalEncounterId,
          current.clinicalProcedureId,
        );
      }
      if (!current.startedAt) {
        throw conflict('ANESTHESIA_STARTED_AT_REQUIRED', 'startedAt is required');
      }
      this.assertTimeRange(current.startedAt, current.endedAt);
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
          'Only the responsible practitioner can finalize this anesthesia record',
        );
      }
      await lockOwner(tx, tenant.organizationId, encounter.ownerIdAtTime);
      await this.lockMemberships(tx, tenant.organizationId, [responsibleId]);
      const responsible = await this.requirePractitioner(tx, tenant.organizationId, responsibleId);
      const professionalDisplayName = responsible.professionalProfile?.displayName.trim();
      if (!professionalDisplayName) {
        throw conflict('PROFESSIONAL_PROFILE_REQUIRED', 'Professional display name is required');
      }
      const owner = await tx.owner.findFirst({
        where: { id: encounter.ownerIdAtTime, organizationId: tenant.organizationId },
        select: { firstName: true, lastName: true },
      });
      if (!owner) throw notFound('OWNER_NOT_FOUND', 'Historical encounter owner not found');
      const updated = await tx.anesthesiaRecord.updateMany({
        where: {
          id: anesthesiaRecordId,
          organizationId: tenant.organizationId,
          status: AnesthesiaRecordStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          status: AnesthesiaRecordStatus.FINALIZED,
          version: { increment: 1 },
          patientNameSnapshot: patient.name,
          ownerDisplayNameSnapshot: `${owner.firstName} ${owner.lastName ?? ''}`.trim(),
          professionalDisplayNameSnapshot: professionalDisplayName,
          professionalLicenseSnapshot:
            normalizeText(responsible.professionalProfile?.licenseNumber) ?? null,
          finalizedAt: new Date(),
          finalizedByMembershipId: tenant.membershipId,
        },
      });
      if (updated.count !== 1) throw conflict('ANESTHESIA_STALE', 'Anesthesia version is stale');
      await this.createAudit(tx, tenant, anesthesiaRecordId, 'FINALIZED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, anesthesiaRecordId);
  }

  // Void is a historical correction, so it does not require active Patient or non-voided parents.
  async void(
    tenant: TenantContext,
    anesthesiaRecordId: string,
    input: VoidAnesthesiaRecordDto,
  ): Promise<AnesthesiaRecordDetail> {
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireRecord(tx, tenant.organizationId, anesthesiaRecordId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockProcedures(tx, tenant.organizationId, [snapshot.clinicalProcedureId]);
      await this.lockRecord(tx, tenant.organizationId, anesthesiaRecordId);
      const current = await this.requireRecord(tx, tenant.organizationId, anesthesiaRecordId);
      this.assertExpectedVersion(current, input.expectedVersion);
      if (current.status !== AnesthesiaRecordStatus.FINALIZED) {
        throw conflict('INVALID_ANESTHESIA_STATE', 'Only finalized anesthesia records can void');
      }
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requirePractitioner(tx, tenant.organizationId, tenant.membershipId);
      const reason = input.reason.trim();
      if (!reason) throw validation('VOID_REASON_REQUIRED', 'Void reason is required');
      const updated = await tx.anesthesiaRecord.updateMany({
        where: {
          id: anesthesiaRecordId,
          organizationId: tenant.organizationId,
          status: AnesthesiaRecordStatus.FINALIZED,
          version: input.expectedVersion,
        },
        data: {
          status: AnesthesiaRecordStatus.VOIDED,
          version: { increment: 1 },
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason,
        },
      });
      if (updated.count !== 1) throw conflict('ANESTHESIA_STALE', 'Anesthesia version is stale');
      await this.createAudit(tx, tenant, anesthesiaRecordId, 'VOIDED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, anesthesiaRecordId);
  }

  async listObservations(
    tenant: TenantContext,
    anesthesiaRecordId: string,
    query: AnesthesiaObservationListQueryDto,
  ): Promise<AnesthesiaObservationListResponse> {
    await this.requireRecord(this.prisma, tenant.organizationId, anesthesiaRecordId);
    const where = { organizationId: tenant.organizationId, anesthesiaRecordId };
    const [rows, total] = await Promise.all([
      this.prisma.anesthesiaObservation.findMany({
        where,
        select: observationSelect,
        orderBy: [{ observedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.anesthesiaObservation.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toObservation(row)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  async createObservation(
    tenant: TenantContext,
    anesthesiaRecordId: string,
    input: CreateAnesthesiaObservationDto,
  ): Promise<AnesthesiaObservationMutationResponse> {
    let created: ObservationEntity | null = null;
    await this.mutateObservationParent(
      tenant,
      anesthesiaRecordId,
      input.expectedVersion,
      async (tx) => {
        const data = this.createObservationData(input);
        this.assertObservationNonEmpty(data);
        created = await tx.anesthesiaObservation.create({
          data: { organizationId: tenant.organizationId, anesthesiaRecordId, ...data },
          select: observationSelect,
        });
        await this.createAudit(tx, tenant, anesthesiaRecordId, 'UPDATED', {
          previousVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
          observationAction: 'ADDED',
          observationId: created.id,
        });
      },
    );
    return {
      anesthesiaRecordVersion: input.expectedVersion + 1,
      observation: created ? this.toObservation(created) : null,
    };
  }

  async updateObservation(
    tenant: TenantContext,
    anesthesiaRecordId: string,
    observationId: string,
    input: UpdateAnesthesiaObservationDto,
  ): Promise<AnesthesiaObservationMutationResponse> {
    let updatedObservation: ObservationEntity | null = null;
    await this.mutateObservationParent(
      tenant,
      anesthesiaRecordId,
      input.expectedVersion,
      async (tx) => {
        await this.lockObservation(tx, tenant.organizationId, anesthesiaRecordId, observationId);
        const current = await this.requireObservation(
          tx,
          tenant.organizationId,
          anesthesiaRecordId,
          observationId,
        );
        const data = this.updateObservationData(input);
        const changedFieldNames = this.changedObservationFields(current, data);
        if (changedFieldNames.length === 0) {
          throw conflict('ANESTHESIA_OBSERVATION_EMPTY', 'Observation update contains no changes');
        }
        const candidate = { ...current, ...data };
        this.assertObservationNonEmpty(candidate);
        updatedObservation = await tx.anesthesiaObservation.update({
          where: { id: observationId },
          data,
          select: observationSelect,
        });
        await this.createAudit(tx, tenant, anesthesiaRecordId, 'UPDATED', {
          previousVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
          observationAction: 'UPDATED',
          observationId,
          changedFieldNames,
        });
      },
    );
    return {
      anesthesiaRecordVersion: input.expectedVersion + 1,
      observation: updatedObservation ? this.toObservation(updatedObservation) : null,
    };
  }

  async removeObservation(
    tenant: TenantContext,
    anesthesiaRecordId: string,
    observationId: string,
    input: RemoveAnesthesiaObservationQueryDto,
  ): Promise<AnesthesiaObservationMutationResponse> {
    await this.mutateObservationParent(
      tenant,
      anesthesiaRecordId,
      input.expectedVersion,
      async (tx) => {
        await this.lockObservation(tx, tenant.organizationId, anesthesiaRecordId, observationId);
        await this.requireObservation(tx, tenant.organizationId, anesthesiaRecordId, observationId);
        await tx.anesthesiaObservation.delete({ where: { id: observationId } });
        await this.createAudit(tx, tenant, anesthesiaRecordId, 'UPDATED', {
          previousVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
          observationAction: 'REMOVED',
          observationId,
        });
      },
    );
    return { anesthesiaRecordVersion: input.expectedVersion + 1, observation: null };
  }

  // Observation mutations share the same parent-state and CAS gate before touching child rows.
  private async mutateObservationParent(
    tenant: TenantContext,
    anesthesiaRecordId: string,
    expectedVersion: number,
    mutate: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireRecord(tx, tenant.organizationId, anesthesiaRecordId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockProcedures(tx, tenant.organizationId, [snapshot.clinicalProcedureId]);
      await this.lockRecord(tx, tenant.organizationId, anesthesiaRecordId);
      const current = await this.requireRecord(tx, tenant.organizationId, anesthesiaRecordId);
      this.assertExpectedVersion(current, expectedVersion);
      if (current.status !== AnesthesiaRecordStatus.DRAFT) {
        throw conflict('ANESTHESIA_IMMUTABLE', 'Only draft anesthesia records can be edited');
      }
      await requireEncounter(tx, tenant.organizationId, current.clinicalEncounterId);
      await requireActivePatient(tx, tenant.organizationId, current.patientId);
      if (current.clinicalProcedureId) {
        await this.requireEligibleProcedure(
          tx,
          tenant.organizationId,
          current.patientId,
          current.clinicalEncounterId,
          current.clinicalProcedureId,
        );
      }
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requireActiveActor(tx, tenant.organizationId, tenant.membershipId);
      await mutate(tx);
      const updated = await tx.anesthesiaRecord.updateMany({
        where: {
          id: anesthesiaRecordId,
          organizationId: tenant.organizationId,
          status: AnesthesiaRecordStatus.DRAFT,
          version: expectedVersion,
        },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) throw conflict('ANESTHESIA_STALE', 'Anesthesia version is stale');
    });
  }

  private editableAnesthesiaData(
    input: CreateAnesthesiaRecordDto | UpdateAnesthesiaRecordDto,
  ): EditableAnesthesiaData {
    const data: EditableAnesthesiaData = {};
    for (const key of editableAnesthesiaFields) {
      const value = input[key];
      if (value === undefined) continue;
      (data as Record<string, unknown>)[key] =
        key === 'startedAt' || key === 'endedAt'
          ? normalizeDate(value as string | null, key)
          : key === 'clinicalProcedureId' || key === 'responsiblePractitionerMembershipId'
            ? value
            : normalizeText(value as string | null);
    }
    return data;
  }

  private createObservationData(
    input: CreateAnesthesiaObservationDto,
  ): ObservationMutationData & { observedAt: Date } {
    const data = this.updateObservationData(input);
    if (!(data.observedAt instanceof Date)) {
      throw validation('VALIDATION_ERROR', 'observedAt is required');
    }
    return data as ObservationMutationData & { observedAt: Date };
  }

  private updateObservationData(
    input: CreateAnesthesiaObservationDto | UpdateAnesthesiaObservationDto,
  ): ObservationMutationData {
    const data: ObservationMutationData = {};
    for (const key of editableObservationFields) {
      const value = input[key];
      if (value === undefined) continue;
      (data as Record<string, unknown>)[key] =
        key === 'observedAt'
          ? normalizeDate(value as string, key)
          : key === 'bloodPressureText' || key === 'anestheticPlane' || key === 'notes'
            ? (normalizeText(value as string | null) ?? null)
            : value;
    }
    return data;
  }

  private changedAnesthesiaFields(current: AnesthesiaRecordEntity, data: EditableAnesthesiaData) {
    return editableAnesthesiaFields.filter(
      (key) => data[key] !== undefined && !this.sameValue(data[key], current[key]),
    );
  }

  private changedObservationFields(current: ObservationEntity, data: ObservationMutationData) {
    return editableObservationFields.filter(
      (key) => data[key] !== undefined && !this.sameValue(data[key], current[key]),
    );
  }

  private assertTimeRange(startedAt: Date | null | undefined, endedAt: Date | null | undefined) {
    if (startedAt && endedAt && endedAt < startedAt) {
      throw conflict('INVALID_ANESTHESIA_TIME_RANGE', 'endedAt must be on or after startedAt');
    }
  }

  private assertObservationNonEmpty(
    observation: ObservationMutationData | Pick<ObservationEntity, EditableObservationField>,
  ) {
    const hasNumeric =
      observation.heartRateBpm !== null && observation.heartRateBpm !== undefined
        ? true
        : observation.respiratoryRatePerMinute !== null &&
            observation.respiratoryRatePerMinute !== undefined
          ? true
          : observation.temperatureC !== null && observation.temperatureC !== undefined
            ? true
            : observation.spo2Percent !== null && observation.spo2Percent !== undefined
              ? true
              : observation.etco2MmHg !== null && observation.etco2MmHg !== undefined;
    const hasText =
      Boolean(observation.bloodPressureText?.trim()) ||
      Boolean(observation.anestheticPlane?.trim()) ||
      Boolean(observation.notes?.trim());
    if (!hasNumeric && !hasText) {
      throw conflict(
        'ANESTHESIA_OBSERVATION_EMPTY',
        'Observation requires at least one clinical field',
      );
    }
  }

  private async requireEligibleProcedure(
    database: DomainDatabase,
    organizationId: string,
    patientId: string,
    clinicalEncounterId: string,
    clinicalProcedureId: string,
  ) {
    const procedure = await database.clinicalProcedure.findFirst({
      where: { id: clinicalProcedureId, organizationId, patientId, clinicalEncounterId },
      select: { id: true, status: true },
    });
    if (!procedure) throw notFound('PROCEDURE_NOT_FOUND', 'Clinical procedure not found');
    if (procedure.status === ClinicalProcedureStatus.VOIDED) {
      throw conflict('PARENT_CLINICAL_PROCEDURE_VOIDED', 'The linked procedure is voided');
    }
    return procedure;
  }

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

  private async lockMemberships(
    database: DomainDatabase,
    organizationId: string,
    membershipIds: string[],
  ): Promise<void> {
    for (const membershipId of [...new Set(membershipIds)].sort()) {
      await lockMembership(database, organizationId, membershipId);
    }
  }

  private async lockProcedures(
    database: DomainDatabase,
    organizationId: string,
    procedureIds: Array<string | null | undefined>,
  ): Promise<void> {
    for (const procedureId of [...new Set(procedureIds.filter(Boolean) as string[])].sort()) {
      await this.lockProcedure(database, organizationId, procedureId);
    }
  }

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

  private async lockRecord(
    database: DomainDatabase,
    organizationId: string,
    anesthesiaRecordId: string,
  ): Promise<void> {
    await database.$queryRaw(Prisma.sql`
      SELECT "id" FROM "anesthesia_records"
      WHERE "id" = ${anesthesiaRecordId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  private async lockObservation(
    database: DomainDatabase,
    organizationId: string,
    anesthesiaRecordId: string,
    observationId: string,
  ): Promise<void> {
    await database.$queryRaw(Prisma.sql`
      SELECT "id" FROM "anesthesia_observations"
      WHERE "id" = ${observationId}::uuid
        AND "organization_id" = ${organizationId}::uuid
        AND "anesthesia_record_id" = ${anesthesiaRecordId}::uuid
      FOR UPDATE
    `);
  }

  private async requireRecord(
    database: DomainDatabase,
    organizationId: string,
    anesthesiaRecordId: string,
  ): Promise<AnesthesiaRecordEntity> {
    const record = await database.anesthesiaRecord.findFirst({
      where: { id: anesthesiaRecordId, organizationId },
      select: anesthesiaSelect,
    });
    if (!record) throw notFound('ANESTHESIA_NOT_FOUND', 'Anesthesia record not found');
    return record;
  }

  private async requireObservation(
    database: DomainDatabase,
    organizationId: string,
    anesthesiaRecordId: string,
    observationId: string,
  ): Promise<ObservationEntity> {
    const observation = await database.anesthesiaObservation.findFirst({
      where: { id: observationId, organizationId, anesthesiaRecordId },
      select: observationSelect,
    });
    if (!observation) {
      throw notFound('ANESTHESIA_OBSERVATION_NOT_FOUND', 'Anesthesia observation not found');
    }
    return observation;
  }

  private assertExpectedVersion(record: AnesthesiaRecordEntity, expectedVersion: number): void {
    if (record.version !== expectedVersion) {
      throw conflict('ANESTHESIA_STALE', 'Anesthesia version is stale');
    }
  }

  private sameValue(left: unknown, right: unknown): boolean {
    if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
    if (left instanceof Date && right === null) return false;
    if (left === null && right instanceof Date) return false;
    if (this.isDecimal(left) || this.isDecimal(right)) {
      const leftNumber = this.isDecimal(left) ? left.toNumber() : left;
      const rightNumber = this.isDecimal(right) ? right.toNumber() : right;
      return leftNumber === rightNumber;
    }
    return left === right;
  }

  private isDecimal(value: unknown): value is Prisma.Decimal {
    return value instanceof Prisma.Decimal;
  }

  private async createAudit(
    database: Prisma.TransactionClient,
    tenant: TenantContext,
    entityId: string,
    action: 'CREATED' | 'UPDATED' | 'FINALIZED' | 'VOIDED',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await database.clinicalAuditEvent.create({
      data: {
        organizationId: tenant.organizationId,
        actorMembershipId: tenant.membershipId,
        entityType: 'ANESTHESIA_RECORD',
        entityId,
        action,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private toSummary(record: AnesthesiaRecordEntity): AnesthesiaRecordSummary {
    return {
      id: record.id,
      organizationId: record.organizationId,
      clinicalEncounterId: record.clinicalEncounterId,
      clinicalProcedureId: record.clinicalProcedureId,
      patientId: record.patientId,
      status: record.status,
      version: record.version,
      startedAt: record.startedAt?.toISOString() ?? null,
      endedAt: record.endedAt?.toISOString() ?? null,
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
      linkedProcedureStatus: record.clinicalProcedure?.status ?? null,
      patient: record.patient,
      encounter: record.clinicalEncounter,
      linkedProcedure: record.clinicalProcedure
        ? {
            id: record.clinicalProcedure.id,
            kind: record.clinicalProcedure.kind,
            status: record.clinicalProcedure.status,
            procedureName: record.clinicalProcedure.procedureName,
          }
        : null,
      responsiblePractitioner: record.responsiblePractitionerMembership
        ? this.toMembershipSummary(record.responsiblePractitionerMembership)
        : null,
      observationCount: record._count.observations,
    };
  }

  private toDetail(record: AnesthesiaRecordEntity): AnesthesiaRecordDetail {
    return {
      ...this.toSummary(record),
      asaClassification: record.asaClassification,
      technique: record.technique,
      preAnestheticAssessment: record.preAnestheticAssessment,
      medicationsText: record.medicationsText,
      airwayManagement: record.airwayManagement,
      fluidsText: record.fluidsText,
      complications: record.complications,
      recoveryNotes: record.recoveryNotes,
      notes: record.notes,
      createdByMembershipId: record.createdByMembershipId,
      finalizedByMembershipId: record.finalizedByMembershipId,
      voidedByMembershipId: record.voidedByMembershipId,
      voidReason: record.voidReason,
    };
  }

  private toObservation(record: ObservationEntity): AnesthesiaObservation {
    return {
      id: record.id,
      organizationId: record.organizationId,
      anesthesiaRecordId: record.anesthesiaRecordId,
      observedAt: record.observedAt.toISOString(),
      heartRateBpm: record.heartRateBpm,
      respiratoryRatePerMinute: record.respiratoryRatePerMinute,
      temperatureC: decimalToNumber(record.temperatureC),
      bloodPressureText: record.bloodPressureText,
      spo2Percent: decimalToNumber(record.spo2Percent),
      etco2MmHg: decimalToNumber(record.etco2MmHg),
      anestheticPlane: record.anestheticPlane,
      notes: record.notes,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

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

  private pagination(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) };
  }
}
