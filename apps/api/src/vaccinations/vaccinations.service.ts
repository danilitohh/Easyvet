import { Injectable } from '@nestjs/common';
import { Prisma, PreventiveRecordStatus } from '@prisma/client';
import type {
  VaccinationDetail,
  VaccinationListResponse,
  VaccinationSummary,
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
  CreateVaccinationDto,
  FinalizeVaccinationDto,
  UpdateVaccinationDto,
  VaccinationListQueryDto,
  VoidVaccinationDto,
} from './vaccination.dto';

const vaccinationSelect = {
  id: true,
  organizationId: true,
  clinicalEncounterId: true,
  patientId: true,
  status: true,
  version: true,
  administeredOn: true,
  nextDueOn: true,
  vaccineName: true,
  vaccineType: true,
  route: true,
  laboratoryName: true,
  lotNumber: true,
  expiryOn: true,
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
} satisfies Prisma.VaccinationSelect;

type VaccinationRecord = Prisma.VaccinationGetPayload<{ select: typeof vaccinationSelect }>;

const editableFields = [
  'administeredOn',
  'nextDueOn',
  'vaccineName',
  'vaccineType',
  'route',
  'laboratoryName',
  'lotNumber',
  'expiryOn',
  'doseText',
  'notes',
  'responsiblePractitionerMembershipId',
  'administeredByMembershipId',
] as const;

// VaccinationsService owns the Vaccination aggregate, lifecycle, CAS and tenant-safe transactions.
@Injectable()
export class VaccinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: VaccinationListQueryDto,
  ): Promise<VaccinationListResponse> {
    await requireAnyPatient(this.prisma, tenant.organizationId, patientId);
    if (query.from && query.to && query.from > query.to) {
      throw validation('VALIDATION_ERROR', 'from must be on or before to');
    }
    const where: Prisma.VaccinationWhereInput = {
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
      this.prisma.vaccination.findMany({
        where,
        select: vaccinationSelect,
        orderBy: [
          { administeredOn: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.vaccination.count({ where }),
    ]);
    return {
      data: data.map((record) => this.toSummary(record)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  }

  async findOne(tenant: TenantContext, vaccinationId: string): Promise<VaccinationDetail> {
    const record = await this.prisma.vaccination.findFirst({
      where: { id: vaccinationId, organizationId: tenant.organizationId },
      select: vaccinationSelect,
    });
    if (!record) throw notFound('VACCINATION_NOT_FOUND', 'Vaccination not found');
    return this.toDetail(record);
  }

  async create(
    tenant: TenantContext,
    encounterId: string,
    input: CreateVaccinationDto,
  ): Promise<VaccinationDetail> {
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
      const created = await tx.vaccination.create({
        data: {
          organizationId: tenant.organizationId,
          clinicalEncounterId: encounterId,
          patientId: encounter.patientId,
          status: PreventiveRecordStatus.DRAFT,
          version: 1,
          administeredOn: parseCivilDate(input.administeredOn, 'administeredOn') ?? null,
          nextDueOn: parseCivilDate(input.nextDueOn, 'nextDueOn') ?? null,
          vaccineName: trimmedNullable(input.vaccineName) ?? null,
          vaccineType: trimmedNullable(input.vaccineType) ?? null,
          route: trimmedNullable(input.route) ?? null,
          laboratoryName: trimmedNullable(input.laboratoryName) ?? null,
          lotNumber: trimmedNullable(input.lotNumber) ?? null,
          expiryOn: parseCivilDate(input.expiryOn, 'expiryOn') ?? null,
          doseText: trimmedNullable(input.doseText) ?? null,
          notes: trimmedNullable(input.notes) ?? null,
          createdByMembershipId: tenant.membershipId,
          responsiblePractitionerMembershipId: input.responsiblePractitionerMembershipId ?? null,
          administeredByMembershipId: input.administeredByMembershipId ?? null,
        },
        select: { id: true },
      });
      await createPreventiveAudit(tx, tenant, 'VACCINATION', created.id, 'CREATED', {
        newVersion: 1,
      });
      return created.id;
    });
    return this.findOne(tenant, createdId);
  }

  async updateDraft(
    tenant: TenantContext,
    vaccinationId: string,
    input: UpdateVaccinationDto,
  ): Promise<VaccinationDetail> {
    requireChangedFields(input, 'expectedVersion');
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireMinimal(tx, tenant.organizationId, vaccinationId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockRecord(tx, tenant.organizationId, vaccinationId);
      const current = await this.requireMinimal(tx, tenant.organizationId, vaccinationId);
      if (current.status !== PreventiveRecordStatus.DRAFT) {
        throw conflict('VACCINATION_IMMUTABLE', 'Only draft vaccinations can be edited');
      }
      if (current.version !== input.expectedVersion) {
        throw conflict('VACCINATION_STALE', 'Vaccination version is stale');
      }
      await requireEncounter(tx, tenant.organizationId, current.clinicalEncounterId);
      await requireActivePatient(tx, tenant.organizationId, current.patientId);
      const has = (field: (typeof editableFields)[number]) =>
        Object.prototype.hasOwnProperty.call(input, field);
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
      const data: Prisma.VaccinationUncheckedUpdateManyInput = { version: { increment: 1 } };
      if (has('administeredOn'))
        data.administeredOn = parseCivilDate(input.administeredOn, 'administeredOn') ?? null;
      if (has('nextDueOn')) data.nextDueOn = parseCivilDate(input.nextDueOn, 'nextDueOn') ?? null;
      if (has('vaccineName')) data.vaccineName = trimmedNullable(input.vaccineName) ?? null;
      if (has('vaccineType')) data.vaccineType = trimmedNullable(input.vaccineType) ?? null;
      if (has('route')) data.route = trimmedNullable(input.route) ?? null;
      if (has('laboratoryName'))
        data.laboratoryName = trimmedNullable(input.laboratoryName) ?? null;
      if (has('lotNumber')) data.lotNumber = trimmedNullable(input.lotNumber) ?? null;
      if (has('expiryOn')) data.expiryOn = parseCivilDate(input.expiryOn, 'expiryOn') ?? null;
      if (has('doseText')) data.doseText = trimmedNullable(input.doseText) ?? null;
      if (has('notes')) data.notes = trimmedNullable(input.notes) ?? null;
      if (has('responsiblePractitionerMembershipId')) {
        data.responsiblePractitionerMembershipId =
          input.responsiblePractitionerMembershipId ?? null;
      }
      if (has('administeredByMembershipId')) {
        data.administeredByMembershipId = input.administeredByMembershipId ?? null;
      }
      const result = await tx.vaccination.updateMany({
        where: {
          id: vaccinationId,
          organizationId: tenant.organizationId,
          status: PreventiveRecordStatus.DRAFT,
          version: input.expectedVersion,
        },
        data,
      });
      if (result.count !== 1) throw conflict('VACCINATION_STALE', 'Vaccination version is stale');
      await createPreventiveAudit(tx, tenant, 'VACCINATION', vaccinationId, 'UPDATED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
        changedFieldNames: editableFields.filter(has),
      });
    });
    return this.findOne(tenant, vaccinationId);
  }

  async finalize(
    tenant: TenantContext,
    vaccinationId: string,
    input: FinalizeVaccinationDto,
  ): Promise<VaccinationDetail> {
    requirePractitionerActor(tenant);
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireMinimal(tx, tenant.organizationId, vaccinationId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockRecord(tx, tenant.organizationId, vaccinationId);
      const current = await this.requireMinimal(tx, tenant.organizationId, vaccinationId);
      if (current.status !== PreventiveRecordStatus.DRAFT) {
        throw conflict('INVALID_VACCINATION_STATE', 'Only draft vaccinations can be finalized');
      }
      if (current.version !== input.expectedVersion)
        throw conflict('VACCINATION_STALE', 'Vaccination version is stale');
      const encounter = await requireEncounter(
        tx,
        tenant.organizationId,
        current.clinicalEncounterId,
      );
      const patient = await requireActivePatient(tx, tenant.organizationId, current.patientId);
      const administeredOn = formatCivilDate(current.administeredOn);
      const vaccineName = trimmedRequired(
        current.vaccineName,
        'VACCINE_NAME_REQUIRED',
        'vaccineName',
      );
      if (!administeredOn) throw conflict('ADMINISTERED_ON_REQUIRED', 'administeredOn is required');
      ensureDateOrder(administeredOn, formatCivilDate(current.nextDueOn));
      if (!current.responsiblePractitionerMembershipId) {
        throw conflict(
          'RESPONSIBLE_PRACTITIONER_REQUIRED',
          'A responsible practitioner is required',
        );
      }
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
        if (!administered.professionalProfile?.displayName.trim()) {
          throw conflict(
            'ADMINISTERED_BY_PROFILE_REQUIRED',
            'A professional profile is required for administeredBy',
          );
        }
        administeredProfile = administered.professionalProfile;
      }
      const owner = await tx.owner.findFirst({
        where: { id: encounter.ownerIdAtTime, organizationId: tenant.organizationId },
        select: { firstName: true, lastName: true },
      });
      if (!owner) throw notFound('RESOURCE_NOT_FOUND', 'Historical owner not found');
      const now = new Date();
      const result = await tx.vaccination.updateMany({
        where: {
          id: vaccinationId,
          organizationId: tenant.organizationId,
          status: PreventiveRecordStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          status: PreventiveRecordStatus.FINALIZED,
          administeredOn: current.administeredOn,
          vaccineName,
          professionalDisplayNameSnapshot: profile.displayName.trim(),
          professionalLicenseSnapshot: profile.licenseNumber?.trim() || null,
          patientNameSnapshot: patient.name.trim(),
          ownerDisplayNameSnapshot: [owner.firstName, owner.lastName]
            .filter(Boolean)
            .join(' ')
            .trim(),
          administeredByDisplayNameSnapshot: administeredProfile?.displayName.trim() ?? null,
          finalizedAt: now,
          finalizedByMembershipId: tenant.membershipId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw conflict('VACCINATION_STALE', 'Vaccination version is stale');
      await createPreventiveAudit(tx, tenant, 'VACCINATION', vaccinationId, 'FINALIZED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, vaccinationId);
  }

  async void(
    tenant: TenantContext,
    vaccinationId: string,
    input: VoidVaccinationDto,
  ): Promise<VaccinationDetail> {
    requirePractitionerActor(tenant);
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await this.requireMinimal(tx, tenant.organizationId, vaccinationId);
      await lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockRecord(tx, tenant.organizationId, vaccinationId);
      // Revalidate and lock the actor inside the same transaction so a concurrent
      // suspension cannot authorize a void after the controller guard passed.
      await lockMembership(tx, tenant.organizationId, tenant.membershipId);
      await requireResponsibleMembership(tx, tenant.organizationId, tenant.membershipId);
      const current = await this.requireMinimal(tx, tenant.organizationId, vaccinationId);
      if (current.status !== PreventiveRecordStatus.FINALIZED)
        throw conflict('INVALID_VACCINATION_STATE', 'Only finalized vaccinations can be voided');
      if (current.version !== input.expectedVersion)
        throw conflict('VACCINATION_STALE', 'Vaccination version is stale');
      const reason = trimmedRequired(input.reason, 'VALIDATION_ERROR', 'reason');
      const result = await tx.vaccination.updateMany({
        where: {
          id: vaccinationId,
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
      if (result.count !== 1) throw conflict('VACCINATION_STALE', 'Vaccination version is stale');
      await createPreventiveAudit(tx, tenant, 'VACCINATION', vaccinationId, 'VOIDED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, vaccinationId);
  }

  private async requireMinimal(database: DomainDatabase, organizationId: string, id: string) {
    const record = await database.vaccination.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        clinicalEncounterId: true,
        patientId: true,
        status: true,
        version: true,
        administeredOn: true,
        nextDueOn: true,
        vaccineName: true,
        responsiblePractitionerMembershipId: true,
        administeredByMembershipId: true,
      },
    });
    if (!record) throw notFound('VACCINATION_NOT_FOUND', 'Vaccination not found');
    return record;
  }

  private async lockRecord(
    database: DomainDatabase,
    organizationId: string,
    id: string,
  ): Promise<void> {
    await database.$queryRaw(Prisma.sql`
      SELECT "id" FROM "vaccinations"
      WHERE "id" = ${id}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  private toProfessional(record: VaccinationRecord['responsiblePractitioner']) {
    return record
      ? {
          membershipId: record.id,
          displayName: record.professionalProfile?.displayName ?? null,
          licenseNumber: record.professionalProfile?.licenseNumber ?? null,
          clinicalRole: record.clinicalRole,
        }
      : null;
  }

  private toSummary(record: VaccinationRecord): VaccinationSummary {
    return {
      id: record.id,
      organizationId: record.organizationId,
      clinicalEncounterId: record.clinicalEncounterId,
      patientId: record.patientId,
      status: record.status,
      version: record.version,
      administeredOn: formatCivilDate(record.administeredOn),
      nextDueOn: formatCivilDate(record.nextDueOn),
      vaccineName: record.vaccineName,
      vaccineType: record.vaccineType,
      route: record.route,
      laboratoryName: record.laboratoryName,
      lotNumber: record.lotNumber,
      expiryOn: formatCivilDate(record.expiryOn),
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

  private toDetail(record: VaccinationRecord): VaccinationDetail {
    return this.toSummary(record);
  }
}
