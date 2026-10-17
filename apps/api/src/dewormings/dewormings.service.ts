import { Injectable } from '@nestjs/common';
import { Prisma, PreventiveRecordStatus } from '@prisma/client';
import type {
  DewormingDetail,
  DewormingListResponse,
  DewormingSummary,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  conflict,
  createPreventiveAudit,
  DomainDatabase,
  ensureDateOrder,
  formatCivilDate,
  lockEncounter,
  lockMembership,
  lockOwner,
  lockPatient,
  notFound,
  pagination,
  parseCivilDate,
  requireActivePatient,
  requireAdministeredMembership,
  requireAnyPatient,
  requireChangedFields,
  requireEncounter,
  requirePractitionerActor,
  requireResponsibleMembership,
  trimmedNullable,
  trimmedRequired,
  validation,
} from '../preventive-care/preventive-care.shared';
import {
  CreateDewormingDto,
  DewormingListQueryDto,
  FinalizeDewormingDto,
  UpdateDewormingDto,
  VoidDewormingDto,
} from './deworming.dto';

const dewormingSelect = {
  id: true,
  organizationId: true,
  clinicalEncounterId: true,
  patientId: true,
  status: true,
  version: true,
  administeredOn: true,
  nextDueOn: true,
  productName: true,
  dewormingType: true,
  doseText: true,
  notes: true,
  createdByMembershipId: true,
  responsiblePractitionerMembershipId: true,
  administeredByMembershipId: true,
  patientNameSnapshot: true,
  ownerDisplayNameSnapshot: true,
  professionalDisplayNameSnapshot: true,
  professionalLicenseSnapshot: true,
  administeredByDisplayNameSnapshot: true,
  finalizedAt: true,
  finalizedByMembershipId: true,
  voidedAt: true,
  voidedByMembershipId: true,
  voidReason: true,
  createdAt: true,
  updatedAt: true,
  patient: { select: { id: true, name: true, status: true } },
  clinicalEncounter: { select: { id: true, status: true } },
  responsiblePractitioner: {
    select: {
      id: true,
      clinicalRole: true,
      professionalProfile: { select: { displayName: true, licenseNumber: true } },
    },
  },
  administeredByMembership: {
    select: {
      id: true,
      clinicalRole: true,
      professionalProfile: { select: { displayName: true, licenseNumber: true } },
    },
  },
} satisfies Prisma.DewormingSelect;

type DewormingRecord = Prisma.DewormingGetPayload<{ select: typeof dewormingSelect }>;

const editableFields = [
  'administeredOn',
  'nextDueOn',
  'productName',
  'dewormingType',
  'doseText',
  'notes',
  'responsiblePractitionerMembershipId',
  'administeredByMembershipId',
] as const;

// DewormingsService owns the Deworming aggregate, lifecycle, CAS and tenant-safe transactions.
@Injectable()
export class DewormingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: DewormingListQueryDto,
  ): Promise<DewormingListResponse> {
    await requireAnyPatient(this.prisma, tenant.organizationId, patientId);
    if (query.from && query.to && query.from > query.to) {
      throw validation('VALIDATION_ERROR', 'from must be on or before to');
    }
    const where: Prisma.DewormingWhereInput = {
      organizationId: tenant.organizationId,
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clinicalEncounterId ? { clinicalEncounterId: query.clinicalEncounterId } : {}),
      ...(query.from || query.to
        ? {
            administeredOn: {
              not: null,
              ...(query.from ? { gte: parseCivilDate(query.from, 'from') as Date } : {}),
              ...(query.to ? { lte: parseCivilDate(query.to, 'to') as Date } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.deworming.findMany({
        where,
        select: dewormingSelect,
        orderBy: [
          { administeredOn: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.deworming.count({ where }),
    ]);
    return {
      data: data.map((record) => this.toSummary(record)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  }

  async findOne(tenant: TenantContext, dewormingId: string): Promise<DewormingDetail> {
    const record = await this.prisma.deworming.findFirst({
      where: { id: dewormingId, organizationId: tenant.organizationId },
      select: dewormingSelect,
    });
    if (!record) throw notFound('DEWORMING_NOT_FOUND', 'Deworming not found');
    return this.toDetail(record);
  }

  async create(
    tenant: TenantContext,
    encounterId: string,
    input: CreateDewormingDto,
  ): Promise<DewormingDetail> {
    const createdId = await this.prisma.$transaction(async (tx) => {
      await lockEncounter(tx, tenant.organizationId, encounterId);
      const encounter = await requireEncounter(tx, tenant.organizationId, encounterId);
      await lockPatient(tx, tenant.organizationId, encounter.patientId);
      await requireActivePatient(tx, tenant.organizationId, encounter.patientId);
      ensureDateOrder(input.administeredOn, input.nextDueOn);
      if (input.responsiblePractitionerMembershipId) {
        await requireResponsibleMembership(
          tx,
          tenant.organizationId,
          input.responsiblePractitionerMembershipId,
        );
      }
      if (input.administeredByMembershipId) {
        await requireAdministeredMembership(
          tx,
          tenant.organizationId,
          input.administeredByMembershipId,
        );
      }
      const created = await tx.deworming.create({
        data: {
          organizationId: tenant.organizationId,
          clinicalEncounterId: encounterId,
          patientId: encounter.patientId,
          status: PreventiveRecordStatus.DRAFT,
          version: 1,
          administeredOn: parseCivilDate(input.administeredOn, 'administeredOn') ?? null,
          nextDueOn: parseCivilDate(input.nextDueOn, 'nextDueOn') ?? null,
          productName: trimmedNullable(input.productName) ?? null,
          dewormingType: trimmedNullable(input.dewormingType) ?? null,
          doseText: trimmedNullable(input.doseText) ?? null,
          notes: trimmedNullable(input.notes) ?? null,
          createdByMembershipId: tenant.membershipId,
          responsiblePractitionerMembershipId: input.responsiblePractitionerMembershipId ?? null,
          administeredByMembershipId: input.administeredByMembershipId ?? null,
        },
        select: { id: true },
      });
      await createPreventiveAudit(tx, tenant, 'DEWORMING', created.id, 'CREATED', {
        newVersion: 1,
      });
      return created.id;
    });
    return this.findOne(tenant, createdId);
  }

  async updateDraft(
    tenant: TenantContext,
    dewormingId: string,
    input: UpdateDewormingDto,
  ): Promise<DewormingDetail> {
    requireChangedFields(input, 'expectedVersion');
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireMinimal(tx, tenant.organizationId, dewormingId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockRecord(tx, tenant.organizationId, dewormingId);
      const current = await this.requireMinimal(tx, tenant.organizationId, dewormingId);
      if (current.status !== PreventiveRecordStatus.DRAFT)
        throw conflict('DEWORMING_IMMUTABLE', 'Only draft dewormings can be edited');
      if (current.version !== input.expectedVersion)
        throw conflict('DEWORMING_STALE', 'Deworming version is stale');
      await requireEncounter(tx, tenant.organizationId, current.clinicalEncounterId);
      await requireActivePatient(tx, tenant.organizationId, current.patientId);
      const has = (field: (typeof editableFields)[number]) =>
        Object.prototype.hasOwnProperty.call(input, field) && input[field] !== undefined;
      const nextAdmin = has('administeredOn')
        ? input.administeredOn
        : formatCivilDate(current.administeredOn);
      const nextDue = has('nextDueOn') ? input.nextDueOn : formatCivilDate(current.nextDueOn);
      ensureDateOrder(nextAdmin, nextDue);
      if (has('responsiblePractitionerMembershipId') && input.responsiblePractitionerMembershipId) {
        await requireResponsibleMembership(
          tx,
          tenant.organizationId,
          input.responsiblePractitionerMembershipId,
        );
      }
      if (has('administeredByMembershipId') && input.administeredByMembershipId) {
        await requireAdministeredMembership(
          tx,
          tenant.organizationId,
          input.administeredByMembershipId,
        );
      }
      const data: Prisma.DewormingUncheckedUpdateManyInput = { version: { increment: 1 } };
      if (has('administeredOn'))
        data.administeredOn = parseCivilDate(input.administeredOn, 'administeredOn') ?? null;
      if (has('nextDueOn')) data.nextDueOn = parseCivilDate(input.nextDueOn, 'nextDueOn') ?? null;
      if (has('productName')) data.productName = trimmedNullable(input.productName) ?? null;
      if (has('dewormingType')) data.dewormingType = trimmedNullable(input.dewormingType) ?? null;
      if (has('doseText')) data.doseText = trimmedNullable(input.doseText) ?? null;
      if (has('notes')) data.notes = trimmedNullable(input.notes) ?? null;
      if (has('responsiblePractitionerMembershipId'))
        data.responsiblePractitionerMembershipId =
          input.responsiblePractitionerMembershipId ?? null;
      if (has('administeredByMembershipId'))
        data.administeredByMembershipId = input.administeredByMembershipId ?? null;
      const result = await tx.deworming.updateMany({
        where: {
          id: dewormingId,
          organizationId: tenant.organizationId,
          status: PreventiveRecordStatus.DRAFT,
          version: input.expectedVersion,
        },
        data,
      });
      if (result.count !== 1) throw conflict('DEWORMING_STALE', 'Deworming version is stale');
      await createPreventiveAudit(tx, tenant, 'DEWORMING', dewormingId, 'UPDATED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
        changedFieldNames: editableFields.filter(has),
      });
    });
    return this.findOne(tenant, dewormingId);
  }

  async finalize(
    tenant: TenantContext,
    dewormingId: string,
    input: FinalizeDewormingDto,
  ): Promise<DewormingDetail> {
    requirePractitionerActor(tenant);
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireMinimal(tx, tenant.organizationId, dewormingId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockRecord(tx, tenant.organizationId, dewormingId);
      const current = await this.requireMinimal(tx, tenant.organizationId, dewormingId);
      if (current.status !== PreventiveRecordStatus.DRAFT)
        throw conflict('INVALID_DEWORMING_STATE', 'Only draft dewormings can be finalized');
      if (current.version !== input.expectedVersion)
        throw conflict('DEWORMING_STALE', 'Deworming version is stale');
      const encounter = await requireEncounter(
        tx,
        tenant.organizationId,
        current.clinicalEncounterId,
      );
      const patient = await requireActivePatient(tx, tenant.organizationId, current.patientId);
      const administeredOn = formatCivilDate(current.administeredOn);
      if (!administeredOn) throw conflict('ADMINISTERED_ON_REQUIRED', 'administeredOn is required');
      const productName = trimmedRequired(
        current.productName,
        'DEWORMING_PRODUCT_REQUIRED',
        'productName',
      );
      ensureDateOrder(administeredOn, formatCivilDate(current.nextDueOn));
      if (!current.responsiblePractitionerMembershipId)
        throw conflict(
          'RESPONSIBLE_PRACTITIONER_REQUIRED',
          'A responsible practitioner is required',
        );
      if (tenant.membershipId !== current.responsiblePractitionerMembershipId) {
        throw conflict(
          'ONLY_RESPONSIBLE_PRACTITIONER_CAN_FINALIZE',
          'Only the responsible practitioner can finalize',
        );
      }
      const membershipIds = [
        current.responsiblePractitionerMembershipId,
        current.administeredByMembershipId,
      ]
        .filter((id): id is string => Boolean(id))
        .filter((id, index, values) => values.indexOf(id) === index)
        .sort();
      await lockOwner(tx, tenant.organizationId, encounter.ownerIdAtTime);
      for (const membershipId of membershipIds)
        await lockMembership(tx, tenant.organizationId, membershipId);
      const responsible = await requireResponsibleMembership(
        tx,
        tenant.organizationId,
        current.responsiblePractitionerMembershipId,
      );
      const profile = responsible.professionalProfile;
      if (!profile?.displayName.trim())
        throw conflict('PROFESSIONAL_PROFILE_REQUIRED', 'A professional profile is required');
      let administeredProfile: { displayName: string; licenseNumber: string | null } | null = null;
      if (current.administeredByMembershipId) {
        const administered = await requireAdministeredMembership(
          tx,
          tenant.organizationId,
          current.administeredByMembershipId,
        );
        if (!administered.professionalProfile?.displayName.trim())
          throw conflict(
            'ADMINISTERED_BY_PROFILE_REQUIRED',
            'A professional profile is required for administeredBy',
          );
        administeredProfile = administered.professionalProfile;
      }
      const owner = await tx.owner.findFirst({
        where: { id: encounter.ownerIdAtTime, organizationId: tenant.organizationId },
        select: { firstName: true, lastName: true },
      });
      if (!owner) throw notFound('RESOURCE_NOT_FOUND', 'Historical owner not found');
      const result = await tx.deworming.updateMany({
        where: {
          id: dewormingId,
          organizationId: tenant.organizationId,
          status: PreventiveRecordStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          status: PreventiveRecordStatus.FINALIZED,
          productName,
          professionalDisplayNameSnapshot: profile.displayName.trim(),
          professionalLicenseSnapshot: profile.licenseNumber?.trim() || null,
          patientNameSnapshot: patient.name.trim(),
          ownerDisplayNameSnapshot: [owner.firstName, owner.lastName]
            .filter(Boolean)
            .join(' ')
            .trim(),
          administeredByDisplayNameSnapshot: administeredProfile?.displayName.trim() ?? null,
          finalizedAt: new Date(),
          finalizedByMembershipId: tenant.membershipId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw conflict('DEWORMING_STALE', 'Deworming version is stale');
      await createPreventiveAudit(tx, tenant, 'DEWORMING', dewormingId, 'FINALIZED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, dewormingId);
  }

  async void(
    tenant: TenantContext,
    dewormingId: string,
    input: VoidDewormingDto,
  ): Promise<DewormingDetail> {
    requirePractitionerActor(tenant);
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireMinimal(tx, tenant.organizationId, dewormingId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockRecord(tx, tenant.organizationId, dewormingId);
      // Revalidate and lock the actor inside the same transaction so a concurrent
      // suspension cannot authorize a void after the controller guard passed.
      await lockMembership(tx, tenant.organizationId, tenant.membershipId);
      await requireResponsibleMembership(tx, tenant.organizationId, tenant.membershipId);
      const current = await this.requireMinimal(tx, tenant.organizationId, dewormingId);
      if (current.status !== PreventiveRecordStatus.FINALIZED)
        throw conflict('INVALID_DEWORMING_STATE', 'Only finalized dewormings can be voided');
      if (current.version !== input.expectedVersion)
        throw conflict('DEWORMING_STALE', 'Deworming version is stale');
      const reason = trimmedRequired(input.reason, 'VALIDATION_ERROR', 'reason');
      const result = await tx.deworming.updateMany({
        where: {
          id: dewormingId,
          organizationId: tenant.organizationId,
          status: PreventiveRecordStatus.FINALIZED,
          version: input.expectedVersion,
        },
        data: {
          status: PreventiveRecordStatus.VOIDED,
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw conflict('DEWORMING_STALE', 'Deworming version is stale');
      await createPreventiveAudit(tx, tenant, 'DEWORMING', dewormingId, 'VOIDED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, dewormingId);
  }

  private async requireMinimal(database: DomainDatabase, organizationId: string, id: string) {
    const record = await database.deworming.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        clinicalEncounterId: true,
        patientId: true,
        status: true,
        version: true,
        administeredOn: true,
        nextDueOn: true,
        productName: true,
        responsiblePractitionerMembershipId: true,
        administeredByMembershipId: true,
      },
    });
    if (!record) throw notFound('DEWORMING_NOT_FOUND', 'Deworming not found');
    return record;
  }

  private async lockRecord(
    database: DomainDatabase,
    organizationId: string,
    id: string,
  ): Promise<void> {
    await database.$queryRaw(Prisma.sql`
      SELECT "id" FROM "dewormings"
      WHERE "id" = ${id}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  private toProfessional(record: DewormingRecord['responsiblePractitioner']) {
    return record
      ? {
          membershipId: record.id,
          displayName: record.professionalProfile?.displayName ?? null,
          licenseNumber: record.professionalProfile?.licenseNumber ?? null,
          clinicalRole: record.clinicalRole,
        }
      : null;
  }

  private toSummary(record: DewormingRecord): DewormingSummary {
    return {
      id: record.id,
      organizationId: record.organizationId,
      clinicalEncounterId: record.clinicalEncounterId,
      patientId: record.patientId,
      status: record.status,
      version: record.version,
      administeredOn: formatCivilDate(record.administeredOn),
      nextDueOn: formatCivilDate(record.nextDueOn),
      productName: record.productName,
      dewormingType: record.dewormingType,
      doseText: record.doseText,
      notes: record.notes,
      createdByMembershipId: record.createdByMembershipId,
      responsiblePractitionerMembershipId: record.responsiblePractitionerMembershipId,
      administeredByMembershipId: record.administeredByMembershipId,
      patientNameSnapshot: record.patientNameSnapshot,
      ownerDisplayNameSnapshot: record.ownerDisplayNameSnapshot,
      professionalDisplayNameSnapshot: record.professionalDisplayNameSnapshot,
      professionalLicenseSnapshot: record.professionalLicenseSnapshot,
      administeredByDisplayNameSnapshot: record.administeredByDisplayNameSnapshot,
      finalizedAt: record.finalizedAt?.toISOString() ?? null,
      finalizedByMembershipId: record.finalizedByMembershipId,
      voidedAt: record.voidedAt?.toISOString() ?? null,
      voidedByMembershipId: record.voidedByMembershipId,
      voidReason: record.voidReason,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      parentEncounterStatus: record.clinicalEncounter.status,
      patient: record.patient,
      encounter: record.clinicalEncounter,
      responsiblePractitioner: this.toProfessional(record.responsiblePractitioner),
      administeredBy: this.toProfessional(record.administeredByMembership),
    };
  }

  private toDetail(record: DewormingRecord): DewormingDetail {
    return this.toSummary(record);
  }
}
