import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  ClinicalEncounterStatus,
  ClinicalRole,
  ClinicLocationStatus,
  HospitalizationStatus,
  MembershipStatus,
  PatientStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type {
  ClinicalEncounterResponse,
  ClinicalEvolutionResponse,
  ClinicalRecordResponse,
  ClinicalVitalResponse,
  ClinicalPractitionerListResponse,
  ClinicalMemberListResponse,
  ClinicalMembershipListQuery,
  ProfessionalProfileResponse,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  ClinicalEncounterQueryDto,
  ClinicalEncounterVersionDto,
  ClinicalVitalQueryDto,
  CreateClinicalEncounterDto,
  CreateClinicalEvolutionDto,
  CreateClinicalVitalDto,
  ClinicalEvolutionQueryDto,
  UpdateClinicalEncounterDto,
  VoidClinicalEncounterDto,
  UpsertProfessionalProfileDto,
} from './clinical.dto';

type DomainDatabase = PrismaService | Prisma.TransactionClient;

const encounterSelect = {
  id: true,
  organizationId: true,
  clinicalRecordId: true,
  patientId: true,
  ownerIdAtTime: true,
  clinicLocationId: true,
  appointmentId: true,
  responsibleMembershipId: true,
  status: true,
  version: true,
  reason: true,
  anamnesis: true,
  physicalExam: true,
  presumptiveDiagnosis: true,
  differentialDiagnosis: true,
  definitiveDiagnosis: true,
  diagnosticPlan: true,
  therapeuticPlan: true,
  recommendations: true,
  followUpPlan: true,
  notes: true,
  professionalDisplayNameSnapshot: true,
  professionalLicenseSnapshot: true,
  finalizedAt: true,
  finalizedByMembershipId: true,
  voidedAt: true,
  voidedByMembershipId: true,
  voidReason: true,
  occurredAt: true,
  createdByMembershipId: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: { id: true, name: true, species: true, status: true, ownerId: true },
  },
  historicalOwner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
    },
  },
  clinicLocation: {
    select: { id: true, name: true, status: true, address: true, city: true },
  },
  responsibleMembership: {
    select: {
      id: true,
      role: true,
      clinicalRole: true,
      professionalProfile: { select: { displayName: true, licenseNumber: true } },
    },
  },
  appointment: {
    select: { id: true, status: true, startsAt: true, endsAt: true, reason: true },
  },
} satisfies Prisma.ClinicalEncounterSelect;

type EncounterRecord = Prisma.ClinicalEncounterGetPayload<{ select: typeof encounterSelect }>;

const vitalSelect = {
  id: true,
  clinicalRecordId: true,
  clinicalEncounterId: true,
  patientId: true,
  measuredAt: true,
  weightKg: true,
  temperatureC: true,
  heartRateBpm: true,
  respiratoryRateBpm: true,
  bodyCondition: true,
  hydration: true,
  mucousMembranes: true,
  skinTurgor: true,
  observations: true,
  recordedByMembershipId: true,
  createdAt: true,
} satisfies Prisma.VitalMeasurementSelect;

type VitalRecord = Prisma.VitalMeasurementGetPayload<{ select: typeof vitalSelect }>;

const evolutionSelect = {
  id: true,
  clinicalRecordId: true,
  clinicalEncounterId: true,
  occurredAt: true,
  subjective: true,
  objective: true,
  assessment: true,
  plan: true,
  authorMembershipId: true,
  createdAt: true,
  authorMembership: {
    select: { professionalProfile: { select: { displayName: true } } },
  },
} satisfies Prisma.ClinicalEvolutionSelect;

type EvolutionRecord = Prisma.ClinicalEvolutionGetPayload<{ select: typeof evolutionSelect }>;

const editableFields = [
  'clinicLocationId',
  'appointmentId',
  'responsibleMembershipId',
  'occurredAt',
  'reason',
  'anamnesis',
  'physicalExam',
  'presumptiveDiagnosis',
  'differentialDiagnosis',
  'definitiveDiagnosis',
  'diagnosticPlan',
  'therapeuticPlan',
  'recommendations',
  'followUpPlan',
  'notes',
] as const;

function notFound(code: string, message: string): NotFoundException {
  return new NotFoundException({ code, message });
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function validation(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

function immutable(): ConflictException {
  return conflict(
    'CLINICAL_ENCOUNTER_IMMUTABLE',
    'Finalized or voided clinical encounters are immutable',
  );
}

function parseInstant(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw validation('Invalid timestamp');
  return parsed;
}

function trimmedNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const result = value.trim();
  return result.length ? result : null;
}

function trimmedRequired(value: string, field: string): string {
  const result = value.trim();
  if (!result) throw validation(`${field} is required`);
  return result;
}

function toDecimalValue(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) return value;
  return value;
}

// ClinicalService owns the clinical state machine, tenant checks and transaction boundaries.
@Injectable()
export class ClinicalService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfessionalProfile(tenant: TenantContext): Promise<ProfessionalProfileResponse> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: tenant.membershipId,
        organizationId: tenant.organizationId,
        status: MembershipStatus.ACTIVE,
        clinicalRole: { not: null },
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        professionalProfile: { select: { displayName: true, licenseNumber: true } },
      },
    });
    if (!membership) throw notFound('RESOURCE_NOT_FOUND', 'Professional profile not found');
    return {
      membershipId: membership.id,
      displayName: membership.professionalProfile?.displayName ?? '',
      licenseNumber: membership.professionalProfile?.licenseNumber ?? null,
    };
  }

  async upsertProfessionalProfile(
    tenant: TenantContext,
    input: UpsertProfessionalProfileDto,
  ): Promise<ProfessionalProfileResponse> {
    const displayName = trimmedRequired(input.displayName, 'displayName');
    const licenseNumber = trimmedNullable(input.licenseNumber) ?? null;
    const profile = await this.prisma.$transaction(async (tx) => {
      // Profile writes share the membership lock used by prescription finalization, so a
      // finalized snapshot always reflects a serialized professional identity.
      await this.lockMembership(tx, tenant.organizationId, tenant.membershipId);
      const membership = await tx.membership.findFirst({
        where: {
          id: tenant.membershipId,
          organizationId: tenant.organizationId,
          status: MembershipStatus.ACTIVE,
          clinicalRole: { not: null },
          user: { status: UserStatus.ACTIVE },
        },
        select: { id: true },
      });
      if (!membership) throw notFound('RESOURCE_NOT_FOUND', 'Professional profile not found');
      return tx.membershipProfessionalProfile.upsert({
        where: { membershipId: membership.id },
        create: {
          organizationId: tenant.organizationId,
          membershipId: membership.id,
          displayName,
          licenseNumber,
        },
        update: { displayName, licenseNumber },
        select: { membershipId: true, displayName: true, licenseNumber: true },
      });
    });
    return profile;
  }

  async listPractitioners(
    tenant: TenantContext,
    query: ClinicalMembershipListQuery,
  ): Promise<ClinicalPractitionerListResponse> {
    const where = {
      organizationId: tenant.organizationId,
      status: MembershipStatus.ACTIVE,
      clinicalRole: ClinicalRole.PRACTITIONER,
      user: { status: UserStatus.ACTIVE },
    };
    const [memberships, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        select: {
          id: true,
          professionalProfile: { select: { displayName: true, licenseNumber: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.membership.count({ where }),
    ]);
    return {
      data: memberships.map((membership) => ({
        membershipId: membership.id,
        displayName: membership.professionalProfile?.displayName ?? null,
        licenseNumber: membership.professionalProfile?.licenseNumber ?? null,
        profileConfigured: Boolean(membership.professionalProfile?.displayName?.trim()),
      })),
      pagination: this.membershipPagination(query, total),
    };
  }

  async listClinicalMembers(
    tenant: TenantContext,
    query: ClinicalMembershipListQuery,
  ): Promise<ClinicalMemberListResponse> {
    const where = {
      organizationId: tenant.organizationId,
      status: MembershipStatus.ACTIVE,
      clinicalRole: { in: [ClinicalRole.PRACTITIONER, ClinicalRole.CLINICAL_ASSISTANT] },
      user: { status: UserStatus.ACTIVE },
    };
    const [memberships, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        select: {
          id: true,
          clinicalRole: true,
          professionalProfile: { select: { displayName: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.membership.count({ where }),
    ]);
    return {
      data: memberships.map((membership) => ({
        membershipId: membership.id,
        clinicalRole: membership.clinicalRole!,
        displayName: membership.professionalProfile?.displayName ?? null,
        profileConfigured: Boolean(membership.professionalProfile?.displayName?.trim()),
      })),
      pagination: this.membershipPagination(query, total),
    };
  }

  private membershipPagination(query: ClinicalMembershipListQuery, total: number) {
    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  async getRecord(
    tenant: TenantContext,
    patientId: string,
  ): Promise<ClinicalRecordResponse | null> {
    await this.requirePatient(this.prisma, tenant.organizationId, patientId, false);
    const record = await this.prisma.clinicalRecord.findFirst({
      where: { organizationId: tenant.organizationId, patientId },
      include: { _count: { select: { encounters: true } } },
    });
    return record ? this.toRecordResponse(record) : null;
  }

  async listEncounters(tenant: TenantContext, patientId: string, query: ClinicalEncounterQueryDto) {
    await this.requirePatient(this.prisma, tenant.organizationId, patientId, false);
    const where: Prisma.ClinicalEncounterWhereInput = {
      organizationId: tenant.organizationId,
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.responsibleMembershipId
        ? { responsibleMembershipId: query.responsibleMembershipId }
        : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: parseInstant(query.from) } : {}),
              ...(query.to ? { lte: parseInstant(query.to) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.clinicalEncounter.findMany({
        where,
        select: encounterSelect,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.clinicalEncounter.count({ where }),
    ]);
    return {
      data: data.map((item) => this.toEncounterResponse(item)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  async findEncounter(
    tenant: TenantContext,
    encounterId: string,
  ): Promise<ClinicalEncounterResponse> {
    const encounter = await this.prisma.clinicalEncounter.findFirst({
      where: { id: encounterId, organizationId: tenant.organizationId },
      select: encounterSelect,
    });
    if (!encounter) throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
    return this.toEncounterResponse(encounter);
  }

  async createEncounter(
    tenant: TenantContext,
    patientId: string,
    input: CreateClinicalEncounterDto,
  ): Promise<ClinicalEncounterResponse> {
    const created = await this.prisma.$transaction(async (tx) => {
      const patient = await this.requirePatient(tx, tenant.organizationId, patientId, true);
      await this.requireActiveLocation(tx, tenant.organizationId, input.clinicLocationId);
      await this.validateResponsible(tx, tenant.organizationId, input.responsibleMembershipId);
      await this.validateAppointment(
        tx,
        tenant.organizationId,
        patient,
        input.clinicLocationId,
        input.appointmentId,
      );
      const record = await this.getOrCreateRecord(tx, tenant, patientId);
      try {
        const encounter = await tx.clinicalEncounter.create({
          data: {
            organizationId: tenant.organizationId,
            clinicalRecordId: record.id,
            patientId,
            ownerIdAtTime: patient.ownerId,
            clinicLocationId: input.clinicLocationId,
            appointmentId: input.appointmentId ?? null,
            responsibleMembershipId: input.responsibleMembershipId ?? null,
            status: ClinicalEncounterStatus.DRAFT,
            version: 1,
            reason: trimmedRequired(input.reason, 'reason'),
            anamnesis: trimmedNullable(input.anamnesis) ?? null,
            physicalExam: trimmedNullable(input.physicalExam) ?? null,
            presumptiveDiagnosis: trimmedNullable(input.presumptiveDiagnosis) ?? null,
            differentialDiagnosis: trimmedNullable(input.differentialDiagnosis) ?? null,
            definitiveDiagnosis: trimmedNullable(input.definitiveDiagnosis) ?? null,
            diagnosticPlan: trimmedNullable(input.diagnosticPlan) ?? null,
            therapeuticPlan: trimmedNullable(input.therapeuticPlan) ?? null,
            recommendations: trimmedNullable(input.recommendations) ?? null,
            followUpPlan: trimmedNullable(input.followUpPlan) ?? null,
            notes: trimmedNullable(input.notes) ?? null,
            occurredAt: parseInstant(input.occurredAt),
            createdByMembershipId: tenant.membershipId,
          },
          select: { id: true },
        });
        await this.createAudit(tx, tenant, 'CLINICAL_ENCOUNTER', encounter.id, 'CREATED', {
          status: ClinicalEncounterStatus.DRAFT,
          version: 1,
        });
        return encounter;
      } catch (error) {
        this.rethrowDatabaseConflict(error);
        throw error;
      }
    });
    return this.findEncounter(tenant, created.id);
  }

  async updateEncounter(
    tenant: TenantContext,
    encounterId: string,
    input: UpdateClinicalEncounterDto,
  ): Promise<ClinicalEncounterResponse> {
    await this.assertEncounterExists(tenant.organizationId, encounterId);
    const updated = await this.prisma
      .$transaction(async (tx) => {
        // Encounter and Patient locks serialize edits with finalization and archive transitions.
        await this.lockEncounter(tx, tenant.organizationId, encounterId);
        const current = await tx.clinicalEncounter.findFirst({
          where: { id: encounterId, organizationId: tenant.organizationId },
          select: {
            id: true,
            status: true,
            version: true,
            patientId: true,
            clinicalRecordId: true,
            ownerIdAtTime: true,
            clinicLocationId: true,
            appointmentId: true,
            responsibleMembershipId: true,
            occurredAt: true,
            reason: true,
            anamnesis: true,
            physicalExam: true,
            presumptiveDiagnosis: true,
            differentialDiagnosis: true,
            definitiveDiagnosis: true,
            diagnosticPlan: true,
            therapeuticPlan: true,
            recommendations: true,
            followUpPlan: true,
            notes: true,
          },
        });
        if (!current)
          throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
        if (current.status !== ClinicalEncounterStatus.DRAFT) throw immutable();
        if (current.version !== input.expectedVersion) {
          throw conflict('CLINICAL_ENCOUNTER_STALE', 'Clinical encounter version is stale');
        }
        await this.lockPatient(tx, tenant.organizationId, current.patientId);
        const patient = await this.requirePatient(
          tx,
          tenant.organizationId,
          current.patientId,
          true,
        );
        const clinicLocationId = input.clinicLocationId ?? current.clinicLocationId;
        const appointmentId =
          input.appointmentId === undefined ? current.appointmentId : input.appointmentId;
        const responsibleMembershipId =
          input.responsibleMembershipId === undefined
            ? current.responsibleMembershipId
            : input.responsibleMembershipId;
        await this.requireActiveLocation(tx, tenant.organizationId, clinicLocationId);
        await this.validateResponsible(tx, tenant.organizationId, responsibleMembershipId);
        await this.validateAppointment(
          tx,
          tenant.organizationId,
          patient,
          clinicLocationId,
          appointmentId,
          encounterId,
        );
        const result = await tx.clinicalEncounter.updateMany({
          where: {
            id: encounterId,
            organizationId: tenant.organizationId,
            status: ClinicalEncounterStatus.DRAFT,
            version: input.expectedVersion,
          },
          data: {
            clinicLocationId,
            appointmentId,
            responsibleMembershipId,
            occurredAt: input.occurredAt ? parseInstant(input.occurredAt) : current.occurredAt,
            reason:
              input.reason === undefined ? current.reason : trimmedRequired(input.reason, 'reason'),
            anamnesis:
              input.anamnesis === undefined
                ? current.anamnesis
                : (trimmedNullable(input.anamnesis) ?? null),
            physicalExam:
              input.physicalExam === undefined
                ? current.physicalExam
                : (trimmedNullable(input.physicalExam) ?? null),
            presumptiveDiagnosis:
              input.presumptiveDiagnosis === undefined
                ? current.presumptiveDiagnosis
                : (trimmedNullable(input.presumptiveDiagnosis) ?? null),
            differentialDiagnosis:
              input.differentialDiagnosis === undefined
                ? current.differentialDiagnosis
                : (trimmedNullable(input.differentialDiagnosis) ?? null),
            definitiveDiagnosis:
              input.definitiveDiagnosis === undefined
                ? current.definitiveDiagnosis
                : (trimmedNullable(input.definitiveDiagnosis) ?? null),
            diagnosticPlan:
              input.diagnosticPlan === undefined
                ? current.diagnosticPlan
                : (trimmedNullable(input.diagnosticPlan) ?? null),
            therapeuticPlan:
              input.therapeuticPlan === undefined
                ? current.therapeuticPlan
                : (trimmedNullable(input.therapeuticPlan) ?? null),
            recommendations:
              input.recommendations === undefined
                ? current.recommendations
                : (trimmedNullable(input.recommendations) ?? null),
            followUpPlan:
              input.followUpPlan === undefined
                ? current.followUpPlan
                : (trimmedNullable(input.followUpPlan) ?? null),
            notes:
              input.notes === undefined ? current.notes : (trimmedNullable(input.notes) ?? null),
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw conflict('CLINICAL_ENCOUNTER_STALE', 'Clinical encounter version is stale');
        }
        await this.createAudit(tx, tenant, 'CLINICAL_ENCOUNTER', encounterId, 'UPDATED', {
          previousVersion: input.expectedVersion,
          newVersion: input.expectedVersion + 1,
          changedFields: editableFields,
        });
        return encounterId;
      })
      .catch((error: unknown) => {
        this.rethrowDatabaseConflict(error);
        throw error;
      });
    return this.findEncounter(tenant, updated);
  }

  async listVitals(tenant: TenantContext, encounterId: string, query: ClinicalVitalQueryDto) {
    await this.requireEncounter(tenant.organizationId, encounterId);
    const where = { organizationId: tenant.organizationId, clinicalEncounterId: encounterId };
    const [data, total] = await Promise.all([
      this.prisma.vitalMeasurement.findMany({
        where,
        select: vitalSelect,
        orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.vitalMeasurement.count({ where }),
    ]);
    return {
      data: data.map((item) => this.toVitalResponse(item)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  async addVital(
    tenant: TenantContext,
    encounterId: string,
    input: CreateClinicalVitalDto,
  ): Promise<ClinicalVitalResponse> {
    const vital = await this.prisma.$transaction(async (tx) => {
      // Lock the encounter before checking DRAFT so finalize and vital creation linearize on the
      // same row; a vital cannot commit after finalization has projected the patient's weight.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "clinical_encounters"
        WHERE "id" = ${encounterId}::uuid AND "organization_id" = ${tenant.organizationId}::uuid
        FOR UPDATE
      `);
      const encounter = await tx.clinicalEncounter.findFirst({
        where: { id: encounterId, organizationId: tenant.organizationId },
        select: { id: true, clinicalRecordId: true, patientId: true, status: true },
      });
      if (!encounter)
        throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
      if (encounter.status !== ClinicalEncounterStatus.DRAFT) throw immutable();
      // Serialize against Patient archive so no new vital can pass an ACTIVE check concurrently.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "patients"
        WHERE "id" = ${encounter.patientId}::uuid AND "organization_id" = ${tenant.organizationId}::uuid
        FOR UPDATE
      `);
      // Archived patients retain readable history but cannot receive new clinical activity.
      await this.requirePatient(tx, tenant.organizationId, encounter.patientId, true);
      const created = await tx.vitalMeasurement.create({
        data: {
          organizationId: tenant.organizationId,
          clinicalRecordId: encounter.clinicalRecordId,
          clinicalEncounterId: encounter.id,
          patientId: encounter.patientId,
          measuredAt: parseInstant(input.measuredAt),
          weightKg: toDecimalValue(input.weightKg) ?? null,
          temperatureC: toDecimalValue(input.temperatureC) ?? null,
          heartRateBpm: input.heartRateBpm ?? null,
          respiratoryRateBpm: input.respiratoryRateBpm ?? null,
          bodyCondition: trimmedNullable(input.bodyCondition) ?? null,
          hydration: trimmedNullable(input.hydration) ?? null,
          mucousMembranes: trimmedNullable(input.mucousMembranes) ?? null,
          skinTurgor: trimmedNullable(input.skinTurgor) ?? null,
          observations: trimmedNullable(input.observations) ?? null,
          recordedByMembershipId: tenant.membershipId,
        },
        select: vitalSelect,
      });
      await this.createAudit(tx, tenant, 'VITAL_MEASUREMENT', created.id, 'VITAL_ADDED', {
        encounterId,
      });
      return created;
    });
    return this.toVitalResponse(vital);
  }

  async finalizeEncounter(
    tenant: TenantContext,
    encounterId: string,
    input: ClinicalEncounterVersionDto,
  ): Promise<ClinicalEncounterResponse> {
    await this.prisma.$transaction(async (tx) => {
      // Finalization shares the Encounter row lock with Prescription operations.
      await this.lockEncounter(tx, tenant.organizationId, encounterId);
      const current = await tx.clinicalEncounter.findFirst({
        where: { id: encounterId, organizationId: tenant.organizationId },
        select: {
          id: true,
          status: true,
          version: true,
          patientId: true,
          responsibleMembershipId: true,
          clinicLocationId: true,
        },
      });
      if (!current) throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
      if (current.status !== ClinicalEncounterStatus.DRAFT) {
        throw conflict(
          'INVALID_CLINICAL_ENCOUNTER_STATE',
          'Only draft encounters can be finalized',
        );
      }
      if (current.version !== input.expectedVersion) {
        throw conflict('CLINICAL_ENCOUNTER_STALE', 'Clinical encounter version is stale');
      }
      // Serialize the active-patient check with archive transitions.
      await this.lockPatient(tx, tenant.organizationId, current.patientId);
      const patient = await this.requirePatient(tx, tenant.organizationId, current.patientId, true);
      await this.requireActiveLocation(tx, tenant.organizationId, current.clinicLocationId);
      if (!current.responsibleMembershipId) {
        throw conflict('PROFESSIONAL_PROFILE_REQUIRED', 'A responsible practitioner is required');
      }
      if (current.responsibleMembershipId !== tenant.membershipId) {
        throw conflict(
          'ONLY_RESPONSIBLE_PRACTITIONER_CAN_FINALIZE',
          'Only the responsible practitioner can finalize this encounter',
        );
      }
      const responsible = await this.requireResponsible(
        tx,
        tenant.organizationId,
        current.responsibleMembershipId,
      );
      const profile = responsible.professionalProfile;
      if (!profile || !profile.displayName.trim()) {
        throw conflict('PROFESSIONAL_PROFILE_REQUIRED', 'A professional profile is required');
      }
      const now = new Date();
      const result = await tx.clinicalEncounter.updateMany({
        where: {
          id: encounterId,
          organizationId: tenant.organizationId,
          status: ClinicalEncounterStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          status: ClinicalEncounterStatus.FINALIZED,
          professionalDisplayNameSnapshot: profile.displayName.trim(),
          professionalLicenseSnapshot: profile.licenseNumber?.trim() || null,
          finalizedAt: now,
          finalizedByMembershipId: tenant.membershipId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw conflict('CLINICAL_ENCOUNTER_STALE', 'Clinical encounter version is stale');
      }
      await this.recalculatePatientWeight(tx, tenant.organizationId, patient.id);
      await this.createAudit(tx, tenant, 'CLINICAL_ENCOUNTER', encounterId, 'FINALIZED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findEncounter(tenant, encounterId);
  }

  async voidEncounter(
    tenant: TenantContext,
    encounterId: string,
    input: VoidClinicalEncounterDto,
  ): Promise<ClinicalEncounterResponse> {
    await this.prisma.$transaction(async (tx) => {
      // Parent void locks follow the same Encounter -> Patient order as clinical satellite writes.
      await this.lockEncounter(tx, tenant.organizationId, encounterId);
      const current = await tx.clinicalEncounter.findFirst({
        where: { id: encounterId, organizationId: tenant.organizationId },
        select: { id: true, status: true, version: true, patientId: true },
      });
      if (!current) throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
      await this.lockPatient(tx, tenant.organizationId, current.patientId);
      const openHospitalization = await tx.hospitalization.findFirst({
        where: {
          organizationId: tenant.organizationId,
          clinicalEncounterId: encounterId,
          status: { in: [HospitalizationStatus.DRAFT, HospitalizationStatus.ACTIVE] },
        },
        select: { id: true },
      });
      if (openHospitalization) {
        throw conflict(
          'ACTIVE_HOSPITALIZATION_EXISTS',
          'A draft or active hospitalization prevents voiding this encounter',
        );
      }
      if (current.status !== ClinicalEncounterStatus.FINALIZED) {
        throw conflict(
          'INVALID_CLINICAL_ENCOUNTER_STATE',
          'Only finalized encounters can be voided',
        );
      }
      if (current.version !== input.expectedVersion) {
        throw conflict('CLINICAL_ENCOUNTER_STALE', 'Clinical encounter version is stale');
      }
      const result = await tx.clinicalEncounter.updateMany({
        where: {
          id: encounterId,
          organizationId: tenant.organizationId,
          status: ClinicalEncounterStatus.FINALIZED,
          version: input.expectedVersion,
        },
        data: {
          status: ClinicalEncounterStatus.VOIDED,
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: trimmedRequired(input.reason, 'reason'),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw conflict('CLINICAL_ENCOUNTER_STALE', 'Clinical encounter version is stale');
      }
      await this.recalculatePatientWeight(tx, tenant.organizationId, current.patientId);
      await this.createAudit(tx, tenant, 'CLINICAL_ENCOUNTER', encounterId, 'VOIDED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
      });
    });
    return this.findEncounter(tenant, encounterId);
  }

  async listEvolutions(tenant: TenantContext, patientId: string, query: ClinicalEvolutionQueryDto) {
    const record = await this.requireRecord(tenant.organizationId, patientId);
    const where: Prisma.ClinicalEvolutionWhereInput = {
      organizationId: tenant.organizationId,
      clinicalRecordId: record.id,
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: parseInstant(query.from) } : {}),
              ...(query.to ? { lte: parseInstant(query.to) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.clinicalEvolution.findMany({
        where,
        select: evolutionSelect,
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.clinicalEvolution.count({ where }),
    ]);
    return {
      data: data.map((item) => this.toEvolutionResponse(item)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  async addEvolution(
    tenant: TenantContext,
    patientId: string,
    input: CreateClinicalEvolutionDto,
  ): Promise<ClinicalEvolutionResponse> {
    const evolution = await this.prisma.$transaction(async (tx) => {
      await this.requirePatient(tx, tenant.organizationId, patientId, true);
      const record = await this.requireRecord(tenant.organizationId, patientId, tx);
      if (input.clinicalEncounterId) {
        const encounter = await tx.clinicalEncounter.findFirst({
          where: {
            id: input.clinicalEncounterId,
            organizationId: tenant.organizationId,
            patientId,
            clinicalRecordId: record.id,
          },
          select: { id: true, status: true },
        });
        if (!encounter)
          throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
        if (encounter.status !== ClinicalEncounterStatus.FINALIZED) {
          throw conflict(
            'INVALID_CLINICAL_ENCOUNTER_STATE',
            'Evolution requires a finalized encounter',
          );
        }
      }
      const narrative = [input.subjective, input.objective, input.assessment, input.plan]
        .map((value) => (value ?? '').trim())
        .some(Boolean);
      if (!narrative) throw validation('At least one evolution field is required');
      const created = await tx.clinicalEvolution.create({
        data: {
          organizationId: tenant.organizationId,
          clinicalRecordId: record.id,
          clinicalEncounterId: input.clinicalEncounterId ?? null,
          occurredAt: parseInstant(input.occurredAt),
          subjective: trimmedNullable(input.subjective) ?? null,
          objective: trimmedNullable(input.objective) ?? null,
          assessment: trimmedNullable(input.assessment) ?? null,
          plan: trimmedNullable(input.plan) ?? null,
          authorMembershipId: tenant.membershipId,
        },
        select: evolutionSelect,
      });
      await this.createAudit(tx, tenant, 'CLINICAL_EVOLUTION', created.id, 'EVOLUTION_ADDED', {
        clinicalEncounterId: input.clinicalEncounterId ?? null,
      });
      return created;
    });
    return this.toEvolutionResponse(evolution);
  }

  private async getOrCreateRecord(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    patientId: string,
  ) {
    // ON CONFLICT keeps the lazy record creation safe under concurrent first encounters without
    // aborting the PostgreSQL transaction on a duplicate-key exception.
    const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "clinical_records" ("id", "organization_id", "patient_id", "created_at", "updated_at")
      VALUES (gen_random_uuid(), ${tenant.organizationId}::uuid, ${patientId}::uuid, now(), now())
      ON CONFLICT ("organization_id", "patient_id") DO NOTHING
      RETURNING "id"
    `);
    const record = await tx.clinicalRecord.findUnique({
      where: {
        organizationId_patientId: { organizationId: tenant.organizationId, patientId },
      },
    });
    if (!record)
      throw notFound('CLINICAL_RECORD_NOT_FOUND', 'Clinical record could not be created');
    if (inserted.length === 1) {
      await this.createAudit(tx, tenant, 'CLINICAL_RECORD', record.id, 'CREATED', {
        status: 'ACTIVE',
        version: 1,
      });
    }
    return record;
  }

  private async requirePatient(
    database: DomainDatabase,
    organizationId: string,
    patientId: string,
    activeOnly: boolean,
  ) {
    const patient = await database.patient.findFirst({
      where: {
        id: patientId,
        organizationId,
        ...(activeOnly ? { status: PatientStatus.ACTIVE } : {}),
      },
      select: { id: true, ownerId: true, status: true },
    });
    if (!patient) throw notFound('RESOURCE_NOT_FOUND', 'Patient not found');
    return patient;
  }

  private async requireActiveLocation(
    database: DomainDatabase,
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    const location = await database.clinicLocation.findFirst({
      where: { id: locationId, organizationId, status: ClinicLocationStatus.ACTIVE },
      select: { id: true },
    });
    if (!location) throw notFound('RESOURCE_NOT_FOUND', 'Clinic location not found');
  }

  private async validateResponsible(
    database: DomainDatabase,
    organizationId: string,
    membershipId: string | null | undefined,
  ): Promise<void> {
    if (membershipId === undefined || membershipId === null) return;
    await this.requireResponsible(database, organizationId, membershipId);
  }

  private async requireResponsible(
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
        role: true,
        clinicalRole: true,
        professionalProfile: { select: { displayName: true, licenseNumber: true } },
      },
    });
    if (!membership) throw notFound('RESOURCE_NOT_FOUND', 'Responsible practitioner not found');
    return membership;
  }

  private async validateAppointment(
    database: DomainDatabase,
    organizationId: string,
    patient: { id: string; ownerId: string },
    clinicLocationId: string,
    appointmentId: string | null | undefined,
    encounterId?: string,
  ): Promise<void> {
    if (appointmentId === undefined || appointmentId === null) return;
    const appointment = await database.appointment.findFirst({
      where: { id: appointmentId, organizationId },
      select: { id: true, patientId: true, clinicLocationId: true, status: true },
    });
    if (!appointment) throw notFound('RESOURCE_NOT_FOUND', 'Appointment not found');
    if (
      appointment.patientId !== patient.id ||
      appointment.clinicLocationId !== clinicLocationId ||
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.NO_SHOW
    ) {
      throw conflict('RESOURCE_CONFLICT', 'Appointment cannot be linked to this encounter');
    }
    const existing = await database.clinicalEncounter.findFirst({
      where: {
        organizationId,
        appointmentId,
        ...(encounterId ? { id: { not: encounterId } } : {}),
      },
      select: { id: true },
    });
    if (existing)
      throw conflict('RESOURCE_CONFLICT', 'Appointment is already linked to an encounter');
  }

  private async requireRecord(
    organizationId: string,
    patientId: string,
    database: DomainDatabase = this.prisma,
  ) {
    const record = await database.clinicalRecord.findFirst({
      where: { organizationId, patientId },
      select: { id: true },
    });
    if (!record) throw notFound('CLINICAL_RECORD_NOT_FOUND', 'Clinical record not found');
    return record;
  }

  private async requireEncounter(organizationId: string, encounterId: string) {
    const encounter = await this.prisma.clinicalEncounter.findFirst({
      where: { id: encounterId, organizationId },
      select: { id: true },
    });
    if (!encounter) throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
    return encounter;
  }

  private async lockEncounter(
    database: DomainDatabase,
    organizationId: string,
    encounterId: string,
  ): Promise<void> {
    await database.$queryRaw(Prisma.sql`
      SELECT "id" FROM "clinical_encounters"
      WHERE "id" = ${encounterId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  private async lockPatient(
    database: DomainDatabase,
    organizationId: string,
    patientId: string,
  ): Promise<void> {
    await database.$queryRaw(Prisma.sql`
      SELECT "id" FROM "patients"
      WHERE "id" = ${patientId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  private async lockMembership(
    database: DomainDatabase,
    organizationId: string,
    membershipId: string,
  ): Promise<void> {
    await database.$queryRaw(Prisma.sql`
      SELECT "id" FROM "memberships"
      WHERE "id" = ${membershipId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  private async assertEncounterExists(organizationId: string, encounterId: string): Promise<void> {
    await this.requireEncounter(organizationId, encounterId);
  }

  private async recalculatePatientWeight(
    tx: Prisma.TransactionClient,
    organizationId: string,
    patientId: string,
  ): Promise<void> {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "patients"
      WHERE "id" = ${patientId}::uuid AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `);
    const latest = await tx.vitalMeasurement.findFirst({
      where: {
        organizationId,
        patientId,
        weightKg: { not: null },
        clinicalEncounter: { status: ClinicalEncounterStatus.FINALIZED },
      },
      orderBy: [{ measuredAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: { weightKg: true },
    });
    await tx.patient.updateMany({
      where: { id: patientId, organizationId },
      data: { currentWeightKg: latest?.weightKg ?? null },
    });
  }

  private async createAudit(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    entityType:
      | 'CLINICAL_RECORD'
      | 'CLINICAL_ENCOUNTER'
      | 'CLINICAL_EVOLUTION'
      | 'VITAL_MEASUREMENT'
      | 'PRESCRIPTION',
    entityId: string,
    action:
      | 'CREATED'
      | 'UPDATED'
      | 'FINALIZED'
      | 'VOIDED'
      | 'EVOLUTION_ADDED'
      | 'VITAL_ADDED'
      | 'PRESCRIPTION_CREATED'
      | 'PRESCRIPTION_UPDATED'
      | 'PRESCRIPTION_FINALIZED'
      | 'PRESCRIPTION_VOIDED',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await tx.clinicalAuditEvent.create({
      data: {
        organizationId: tenant.organizationId,
        actorMembershipId: tenant.membershipId,
        entityType,
        entityId,
        action,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private rethrowDatabaseConflict(error: unknown): void {
    if (this.isPrismaCode(error, 'P2002'))
      throw conflict('RESOURCE_CONFLICT', 'Clinical resource conflicts with an existing resource');
    if (this.isPrismaCode(error, 'P2003'))
      throw notFound('RESOURCE_NOT_FOUND', 'Referenced resource not found');
  }

  private isPrismaCode(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }

  private pagination(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  private toRecordResponse(record: {
    id: string;
    organizationId: string;
    patientId: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: { encounters: number };
  }): ClinicalRecordResponse {
    return {
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      ...(record._count ? { encounterCount: record._count.encounters } : {}),
    };
  }

  private toEncounterResponse(encounter: EncounterRecord): ClinicalEncounterResponse {
    return {
      id: encounter.id,
      organizationId: encounter.organizationId,
      clinicalRecordId: encounter.clinicalRecordId,
      patientId: encounter.patientId,
      ownerIdAtTime: encounter.ownerIdAtTime,
      clinicLocationId: encounter.clinicLocationId,
      appointmentId: encounter.appointmentId,
      responsibleMembershipId: encounter.responsibleMembershipId,
      status: encounter.status,
      version: encounter.version,
      reason: encounter.reason,
      anamnesis: encounter.anamnesis,
      physicalExam: encounter.physicalExam,
      presumptiveDiagnosis: encounter.presumptiveDiagnosis,
      differentialDiagnosis: encounter.differentialDiagnosis,
      definitiveDiagnosis: encounter.definitiveDiagnosis,
      diagnosticPlan: encounter.diagnosticPlan,
      therapeuticPlan: encounter.therapeuticPlan,
      recommendations: encounter.recommendations,
      followUpPlan: encounter.followUpPlan,
      notes: encounter.notes,
      professionalDisplayNameSnapshot: encounter.professionalDisplayNameSnapshot,
      professionalLicenseSnapshot: encounter.professionalLicenseSnapshot,
      finalizedAt: encounter.finalizedAt?.toISOString() ?? null,
      finalizedByMembershipId: encounter.finalizedByMembershipId,
      voidedAt: encounter.voidedAt?.toISOString() ?? null,
      voidedByMembershipId: encounter.voidedByMembershipId,
      voidReason: encounter.voidReason,
      occurredAt: encounter.occurredAt.toISOString(),
      createdByMembershipId: encounter.createdByMembershipId,
      createdAt: encounter.createdAt.toISOString(),
      updatedAt: encounter.updatedAt.toISOString(),
      patient: encounter.patient,
      historicalOwner: encounter.historicalOwner,
      clinicLocation: encounter.clinicLocation,
      responsibleProfessional: encounter.responsibleMembership
        ? {
            membershipId: encounter.responsibleMembership.id,
            displayName: encounter.responsibleMembership.professionalProfile?.displayName ?? null,
            licenseNumber:
              encounter.responsibleMembership.professionalProfile?.licenseNumber ?? null,
            role: encounter.responsibleMembership.role,
            clinicalRole: encounter.responsibleMembership.clinicalRole,
          }
        : null,
      appointment: encounter.appointment
        ? {
            id: encounter.appointment.id,
            status: encounter.appointment.status,
            startsAt: encounter.appointment.startsAt.toISOString(),
            endsAt: encounter.appointment.endsAt.toISOString(),
            reason: encounter.appointment.reason,
          }
        : null,
    };
  }

  private toVitalResponse(vital: VitalRecord): ClinicalVitalResponse {
    return {
      id: vital.id,
      clinicalRecordId: vital.clinicalRecordId,
      clinicalEncounterId: vital.clinicalEncounterId,
      patientId: vital.patientId,
      measuredAt: vital.measuredAt.toISOString(),
      weightKg: vital.weightKg === null ? null : Number(vital.weightKg),
      temperatureC: vital.temperatureC === null ? null : Number(vital.temperatureC),
      heartRateBpm: vital.heartRateBpm,
      respiratoryRateBpm: vital.respiratoryRateBpm,
      bodyCondition: vital.bodyCondition,
      hydration: vital.hydration,
      mucousMembranes: vital.mucousMembranes,
      skinTurgor: vital.skinTurgor,
      observations: vital.observations,
      recordedByMembershipId: vital.recordedByMembershipId,
      createdAt: vital.createdAt.toISOString(),
    };
  }

  private toEvolutionResponse(evolution: EvolutionRecord): ClinicalEvolutionResponse {
    return {
      id: evolution.id,
      clinicalRecordId: evolution.clinicalRecordId,
      clinicalEncounterId: evolution.clinicalEncounterId,
      occurredAt: evolution.occurredAt.toISOString(),
      subjective: evolution.subjective,
      objective: evolution.objective,
      assessment: evolution.assessment,
      plan: evolution.plan,
      authorMembershipId: evolution.authorMembershipId,
      authorDisplayName:
        evolution.authorMembership.professionalProfile?.displayName?.trim() || null,
      createdAt: evolution.createdAt.toISOString(),
    };
  }
}
