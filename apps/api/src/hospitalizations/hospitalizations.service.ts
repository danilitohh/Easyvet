import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalEncounterStatus,
  ClinicalRole,
  HospitalizationStatus,
  MembershipStatus,
  PatientStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type {
  HospitalizationDetail,
  HospitalizationEntriesResponse,
  HospitalizationEntry,
  HospitalizationListResponse,
  HospitalizationSummary,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  CreateHospitalizationDto,
  CreateHospitalizationEntryDto,
  DischargeHospitalizationDto,
  HospitalizationEntriesQueryDto,
  HospitalizationListQueryDto,
  UpdateHospitalizationDto,
  VoidHospitalizationDto,
} from './hospitalization.dto';

type Transaction = Prisma.TransactionClient;

const detailSelect = {
  id: true,
  organizationId: true,
  clinicalEncounterId: true,
  patientId: true,
  status: true,
  version: true,
  admittedAt: true,
  dischargedAt: true,
  locationName: true,
  admissionReason: true,
  diagnosis: true,
  treatmentPlan: true,
  medicationsText: true,
  dietInstructions: true,
  dischargeSummary: true,
  dischargeRecommendations: true,
  notes: true,
  responsiblePractitionerMembershipId: true,
  createdByMembershipId: true,
  patientNameSnapshot: true,
  ownerDisplayNameSnapshot: true,
  professionalDisplayNameSnapshot: true,
  professionalLicenseSnapshot: true,
  activatedAt: true,
  activatedByMembershipId: true,
  dischargedByMembershipId: true,
  voidedAt: true,
  voidedByMembershipId: true,
  voidReason: true,
  createdAt: true,
  updatedAt: true,
  clinicalEncounter: { select: { status: true, ownerIdAtTime: true } },
  patient: { select: { id: true, name: true, status: true } },
  _count: { select: { entries: true } },
} satisfies Prisma.HospitalizationSelect;

type HospitalizationRecord = Prisma.HospitalizationGetPayload<{ select: typeof detailSelect }>;
type EntryRecord = Prisma.HospitalizationEntryGetPayload<{
  include: {
    recordedByMembership: { select: { professionalProfile: { select: { displayName: true } } } };
  };
}>;
const textFields = [
  'locationName',
  'admissionReason',
  'diagnosis',
  'treatmentPlan',
  'medicationsText',
  'dietInstructions',
  'dischargeSummary',
  'dischargeRecommendations',
  'notes',
] as const;
const activeEditableFields = new Set([
  'locationName',
  'admissionReason',
  'diagnosis',
  'treatmentPlan',
  'medicationsText',
  'dietInstructions',
  'notes',
]);

// Owns tenant-scoped hospitalization lifecycle, Kardex entries, CAS and audit operations.
@Injectable()
export class HospitalizationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Lists a patient's episodes with deterministic ordering and bounded pagination.
  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: HospitalizationListQueryDto,
  ): Promise<HospitalizationListResponse> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!patient) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Patient not found');
    if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
      throw this.badRequest('VALIDATION_ERROR', 'from must be on or before to');
    }
    const where: Prisma.HospitalizationWhereInput = {
      organizationId: tenant.organizationId,
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clinicalEncounterId ? { clinicalEncounterId: query.clinicalEncounterId } : {}),
      ...(query.from || query.to
        ? {
            admittedAt: {
              not: null,
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.hospitalization.findMany({
        where,
        select: detailSelect,
        orderBy: [
          { admittedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.hospitalization.count({ where }),
    ]);
    return {
      data: records.map((record) => this.toSummary(record)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  // Historical detail remains readable after archive or parent-encounter void.
  async findOne(tenant: TenantContext, hospitalizationId: string): Promise<HospitalizationDetail> {
    const record = await this.prisma.hospitalization.findFirst({
      where: { id: hospitalizationId, organizationId: tenant.organizationId },
      select: detailSelect,
    });
    if (!record) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Hospitalization not found');
    return this.toDetail(record);
  }

  // Creates an incomplete DRAFT under parent locks; encounter uniqueness closes create races.
  async create(
    tenant: TenantContext,
    encounterId: string,
    input: CreateHospitalizationDto,
  ): Promise<HospitalizationDetail> {
    try {
      const createdId = await this.prisma.$transaction(async (tx) => {
        await this.lockEncounter(tx, tenant.organizationId, encounterId);
        const encounter = await tx.clinicalEncounter.findFirst({
          where: { id: encounterId, organizationId: tenant.organizationId },
          select: { id: true, patientId: true, status: true },
        });
        if (!encounter) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Encounter not found');
        await this.lockPatient(tx, tenant.organizationId, encounter.patientId);
        const patient = await tx.patient.findFirst({
          where: { id: encounter.patientId, organizationId: tenant.organizationId },
          select: { id: true, status: true },
        });
        if (!patient) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Patient not found');
        this.requireActivePatient(patient.status);
        this.requireParentNotVoided(encounter.status);
        await this.lockMemberships(tx, tenant.organizationId, [
          tenant.membershipId,
          ...(input.responsiblePractitionerMembershipId
            ? [input.responsiblePractitionerMembershipId]
            : []),
        ]);
        await this.requireActiveClinicalMembership(tx, tenant, false);
        if (input.responsiblePractitionerMembershipId)
          await this.requireActivePractitioner(
            tx,
            tenant.organizationId,
            input.responsiblePractitionerMembershipId,
          );
        const record = await tx.hospitalization.create({
          data: {
            organizationId: tenant.organizationId,
            clinicalEncounterId: encounter.id,
            patientId: encounter.patientId,
            status: HospitalizationStatus.DRAFT,
            version: 1,
            admittedAt: input.admittedAt ? new Date(input.admittedAt) : null,
            locationName: this.normalizeText(input.locationName) ?? null,
            admissionReason: this.normalizeText(input.admissionReason) ?? null,
            diagnosis: this.normalizeText(input.diagnosis) ?? null,
            treatmentPlan: this.normalizeText(input.treatmentPlan) ?? null,
            medicationsText: this.normalizeText(input.medicationsText) ?? null,
            dietInstructions: this.normalizeText(input.dietInstructions) ?? null,
            notes: this.normalizeText(input.notes) ?? null,
            responsiblePractitionerMembershipId: input.responsiblePractitionerMembershipId ?? null,
            createdByMembershipId: tenant.membershipId,
          },
          select: { id: true },
        });
        await this.audit(
          tx,
          tenant,
          record.id,
          'HOSPITALIZATION_CREATED',
          0,
          1,
          HospitalizationStatus.DRAFT,
        );
        return record.id;
      });
      return this.findOne(tenant, createdId);
    } catch (error) {
      if (this.isUniqueConflict(error))
        throw this.conflict(
          'HOSPITALIZATION_EXISTS_FOR_ENCOUNTER',
          'This clinical encounter already has a hospitalization',
        );
      throw error;
    }
  }

  // Drafts permit admission identity changes; ACTIVE episodes may update only clinical plan fields.
  async updateDraft(
    tenant: TenantContext,
    hospitalizationId: string,
    input: UpdateHospitalizationDto,
  ): Promise<HospitalizationDetail> {
    const snapshot = await this.requireSnapshot(tenant, hospitalizationId);
    await this.prisma.$transaction(async (tx) => {
      await this.lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockHospitalization(tx, tenant.organizationId, hospitalizationId);
      const current = await this.requireLockedRecord(tx, tenant, hospitalizationId);
      this.requireEditableStatus(current.status);
      this.requireParentNotVoided(current.clinicalEncounter.status);
      await this.lockOwner(tx, tenant.organizationId, current.clinicalEncounter.ownerIdAtTime);
      await this.requirePatientStatus(tx, tenant.organizationId, current.patientId, true);
      if (current.version !== input.expectedVersion) throw this.stale();
      const providedFields = Object.keys(input).filter((key) => key !== 'expectedVersion');
      if (!providedFields.length)
        throw this.badRequest('VALIDATION_ERROR', 'At least one editable field is required');
      if (
        current.status === HospitalizationStatus.ACTIVE &&
        providedFields.some((field) => !activeEditableFields.has(field))
      ) {
        throw this.conflict(
          'HOSPITALIZATION_IMMUTABLE',
          'Active hospitalization identity is immutable',
        );
      }
      const responsibleId =
        current.status === HospitalizationStatus.DRAFT
          ? input.responsiblePractitionerMembershipId
          : undefined;
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        ...(responsibleId ? [responsibleId] : []),
      ]);
      await this.requireActiveClinicalMembership(tx, tenant, false);
      if (responsibleId)
        await this.requireActivePractitioner(tx, tenant.organizationId, responsibleId);

      const data: Prisma.HospitalizationUncheckedUpdateManyInput = { version: { increment: 1 } };
      for (const field of textFields.filter(
        (name) => name !== 'dischargeSummary' && name !== 'dischargeRecommendations',
      )) {
        if (Object.prototype.hasOwnProperty.call(input, field)) {
          const value = (input as unknown as Record<string, string | null | undefined>)[field];
          (data as Record<string, unknown>)[field] = this.normalizeText(value) ?? null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(input, 'admittedAt')) {
        data.admittedAt = input.admittedAt ? new Date(input.admittedAt) : null;
      }
      if (Object.prototype.hasOwnProperty.call(input, 'responsiblePractitionerMembershipId')) {
        data.responsiblePractitionerMembershipId =
          input.responsiblePractitionerMembershipId ?? null;
      }
      const updated = await tx.hospitalization.updateMany({
        where: {
          id: hospitalizationId,
          organizationId: tenant.organizationId,
          version: input.expectedVersion,
        },
        data,
      });
      if (updated.count !== 1) throw this.stale();
      await this.audit(
        tx,
        tenant,
        hospitalizationId,
        'HOSPITALIZATION_UPDATED',
        current.version,
        current.version + 1,
        current.status,
      );
    });
    return this.findOne(tenant, hospitalizationId);
  }

  // Activation freezes encounter-era identity snapshots and is authored by its responsible practitioner.
  async activate(
    tenant: TenantContext,
    hospitalizationId: string,
    expectedVersion: number,
  ): Promise<HospitalizationDetail> {
    const snapshot = await this.requireSnapshot(tenant, hospitalizationId);
    await this.prisma.$transaction(async (tx) => {
      await this.lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockHospitalization(tx, tenant.organizationId, hospitalizationId);
      const current = await this.requireLockedRecord(tx, tenant, hospitalizationId);
      if (current.status !== HospitalizationStatus.DRAFT) throw this.invalidState();
      this.requireParentNotVoided(current.clinicalEncounter.status);
      await this.requirePatientStatus(tx, tenant.organizationId, current.patientId, true);
      if (current.version !== expectedVersion) throw this.stale();
      if (!current.admittedAt)
        throw this.conflict('ADMISSION_DATE_REQUIRED', 'Admission date is required');
      const responsibleId = current.responsiblePractitionerMembershipId;
      if (!responsibleId)
        throw this.conflict(
          'RESPONSIBLE_PRACTITIONER_REQUIRED',
          'Responsible practitioner is required',
        );
      if (
        responsibleId !== tenant.membershipId ||
        tenant.clinicalRole !== ClinicalRole.PRACTITIONER
      ) {
        throw this.forbidden(
          'ONLY_RESPONSIBLE_PRACTITIONER_CAN_ACTIVATE',
          'Only the responsible practitioner can activate this hospitalization',
        );
      }
      await this.lockOwner(tx, tenant.organizationId, current.clinicalEncounter.ownerIdAtTime);
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId, responsibleId]);
      const [actor, patient, owner] = await Promise.all([
        this.requireActivePractitioner(tx, tenant.organizationId, responsibleId),
        tx.patient.findFirst({
          where: { id: current.patientId, organizationId: tenant.organizationId },
          select: { name: true, status: true },
        }),
        tx.owner.findFirst({
          where: {
            id: current.clinicalEncounter.ownerIdAtTime,
            organizationId: tenant.organizationId,
          },
          select: { firstName: true, lastName: true },
        }),
      ]);
      if (!patient || !owner)
        throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Historical context not found');
      this.requireActivePatient(patient.status);
      const updated = await tx.hospitalization.updateMany({
        where: {
          id: hospitalizationId,
          organizationId: tenant.organizationId,
          status: HospitalizationStatus.DRAFT,
          version: expectedVersion,
        },
        data: {
          status: HospitalizationStatus.ACTIVE,
          version: { increment: 1 },
          activatedAt: new Date(),
          activatedByMembershipId: tenant.membershipId,
          patientNameSnapshot: patient.name,
          ownerDisplayNameSnapshot: `${owner.firstName} ${owner.lastName}`.trim(),
          professionalDisplayNameSnapshot: actor.professionalProfile!.displayName.trim(),
          professionalLicenseSnapshot: actor.professionalProfile!.licenseNumber?.trim() || null,
        },
      });
      if (updated.count !== 1) throw this.stale();
      await this.audit(
        tx,
        tenant,
        hospitalizationId,
        'HOSPITALIZATION_ACTIVATED',
        expectedVersion,
        expectedVersion + 1,
        HospitalizationStatus.ACTIVE,
      );
    });
    return this.findOne(tenant, hospitalizationId);
  }

  // Adds a single append-only entry and increments the aggregate version atomically.
  async createEntry(
    tenant: TenantContext,
    hospitalizationId: string,
    input: CreateHospitalizationEntryDto,
  ): Promise<HospitalizationEntry> {
    const snapshot = await this.requireSnapshot(tenant, hospitalizationId);
    const content = this.normalizeText(input.content);
    const hasVital = [
      input.temperatureC,
      input.heartRateBpm,
      input.respiratoryRatePerMinute,
      input.weightKg,
    ].some((value) => value !== undefined && value !== null);
    if (!content && !hasVital)
      throw this.badRequest(
        'HOSPITALIZATION_ENTRY_EMPTY',
        'An entry requires text or at least one measurement',
      );
    const entryId = await this.prisma.$transaction(async (tx) => {
      await this.lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockHospitalization(tx, tenant.organizationId, hospitalizationId);
      const current = await this.requireLockedRecord(tx, tenant, hospitalizationId);
      if (current.status !== HospitalizationStatus.ACTIVE) throw this.invalidState();
      this.requireParentNotVoided(current.clinicalEncounter.status);
      await this.lockOwner(tx, tenant.organizationId, current.clinicalEncounter.ownerIdAtTime);
      await this.requirePatientStatus(tx, tenant.organizationId, current.patientId, true);
      if (current.version !== input.expectedVersion) throw this.stale();
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requireActiveClinicalMembership(tx, tenant, false);
      const updated = await tx.hospitalization.updateMany({
        where: {
          id: hospitalizationId,
          organizationId: tenant.organizationId,
          status: HospitalizationStatus.ACTIVE,
          version: input.expectedVersion,
        },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) throw this.stale();
      const entry = await tx.hospitalizationEntry.create({
        data: {
          organizationId: tenant.organizationId,
          hospitalizationId,
          entryType: input.entryType,
          recordedAt: new Date(input.recordedAt),
          content: content ?? null,
          temperatureC: input.temperatureC ?? null,
          heartRateBpm: input.heartRateBpm ?? null,
          respiratoryRatePerMinute: input.respiratoryRatePerMinute ?? null,
          weightKg: input.weightKg ?? null,
          recordedByMembershipId: tenant.membershipId,
        },
        select: { id: true },
      });
      await this.audit(
        tx,
        tenant,
        hospitalizationId,
        'HOSPITALIZATION_ENTRY_ADDED',
        input.expectedVersion,
        input.expectedVersion + 1,
        HospitalizationStatus.ACTIVE,
      );
      return entry.id;
    });
    return this.findEntry(tenant, hospitalizationId, entryId);
  }

  // Reads a bounded, chronologically ordered Kardex page; no mutation endpoint exists for entries.
  async listEntries(
    tenant: TenantContext,
    hospitalizationId: string,
    query: HospitalizationEntriesQueryDto,
  ): Promise<HospitalizationEntriesResponse> {
    const exists = await this.prisma.hospitalization.findFirst({
      where: { id: hospitalizationId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Hospitalization not found');
    const where = { organizationId: tenant.organizationId, hospitalizationId };
    const [rows, total] = await Promise.all([
      this.prisma.hospitalizationEntry.findMany({
        where,
        include: {
          recordedByMembership: {
            select: { professionalProfile: { select: { displayName: true } } },
          },
        },
        orderBy: [{ recordedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.hospitalizationEntry.count({ where }),
    ]);
    return {
      data: rows.map((row) =>
        this.toEntry(row, row.recordedByMembership.professionalProfile?.displayName ?? null),
      ),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  // Any active practitioner can discharge; the admitted-to-discharged timestamp is checked in app and DB.
  async discharge(
    tenant: TenantContext,
    hospitalizationId: string,
    input: DischargeHospitalizationDto,
  ): Promise<HospitalizationDetail> {
    this.requirePractitionerActor(tenant);
    const snapshot = await this.requireSnapshot(tenant, hospitalizationId);
    const dischargedAt = new Date(input.dischargedAt);
    await this.prisma.$transaction(async (tx) => {
      await this.lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockHospitalization(tx, tenant.organizationId, hospitalizationId);
      const current = await this.requireLockedRecord(tx, tenant, hospitalizationId);
      if (current.status !== HospitalizationStatus.ACTIVE) throw this.invalidState();
      this.requireParentNotVoided(current.clinicalEncounter.status);
      await this.lockOwner(tx, tenant.organizationId, current.clinicalEncounter.ownerIdAtTime);
      await this.requirePatientStatus(tx, tenant.organizationId, current.patientId, true);
      if (current.version !== input.expectedVersion) throw this.stale();
      if (!current.admittedAt || dischargedAt < current.admittedAt)
        throw this.badRequest('INVALID_DISCHARGE_TIME', 'Discharge cannot precede admission');
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requireActivePractitioner(tx, tenant.organizationId, tenant.membershipId);
      const updated = await tx.hospitalization.updateMany({
        where: {
          id: hospitalizationId,
          organizationId: tenant.organizationId,
          status: HospitalizationStatus.ACTIVE,
          version: input.expectedVersion,
        },
        data: {
          status: HospitalizationStatus.DISCHARGED,
          version: { increment: 1 },
          dischargedAt,
          dischargedByMembershipId: tenant.membershipId,
          dischargeSummary: this.normalizeText(input.dischargeSummary) ?? null,
          dischargeRecommendations: this.normalizeText(input.dischargeRecommendations) ?? null,
        },
      });
      if (updated.count !== 1) throw this.stale();
      await this.audit(
        tx,
        tenant,
        hospitalizationId,
        'HOSPITALIZATION_DISCHARGED',
        input.expectedVersion,
        input.expectedVersion + 1,
        HospitalizationStatus.DISCHARGED,
      );
    });
    return this.findOne(tenant, hospitalizationId);
  }

  // Void preserves active or discharged history, including when its patient was archived.
  async void(
    tenant: TenantContext,
    hospitalizationId: string,
    input: VoidHospitalizationDto,
  ): Promise<HospitalizationDetail> {
    this.requirePractitionerActor(tenant);
    const snapshot = await this.requireSnapshot(tenant, hospitalizationId);
    await this.prisma.$transaction(async (tx) => {
      await this.lockEncounter(tx, tenant.organizationId, snapshot.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, snapshot.patientId);
      await this.lockHospitalization(tx, tenant.organizationId, hospitalizationId);
      const current = await this.requireLockedRecord(tx, tenant, hospitalizationId);
      if (
        current.status !== HospitalizationStatus.ACTIVE &&
        current.status !== HospitalizationStatus.DISCHARGED
      )
        throw this.invalidState();
      await this.lockOwner(tx, tenant.organizationId, current.clinicalEncounter.ownerIdAtTime);
      if (current.version !== input.expectedVersion) throw this.stale();
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requireActivePractitioner(tx, tenant.organizationId, tenant.membershipId);
      const updated = await tx.hospitalization.updateMany({
        where: {
          id: hospitalizationId,
          organizationId: tenant.organizationId,
          status: current.status,
          version: input.expectedVersion,
        },
        data: {
          status: HospitalizationStatus.VOIDED,
          version: { increment: 1 },
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: input.reason.trim(),
        },
      });
      if (updated.count !== 1) throw this.stale();
      await this.audit(
        tx,
        tenant,
        hospitalizationId,
        'HOSPITALIZATION_VOIDED',
        input.expectedVersion,
        input.expectedVersion + 1,
        HospitalizationStatus.VOIDED,
      );
    });
    return this.findOne(tenant, hospitalizationId);
  }

  // Re-fetches one newly committed entry with tenant predicates before returning it.
  private async findEntry(
    tenant: TenantContext,
    hospitalizationId: string,
    entryId: string,
  ): Promise<HospitalizationEntry> {
    const row = await this.prisma.hospitalizationEntry.findFirst({
      where: { id: entryId, hospitalizationId, organizationId: tenant.organizationId },
      include: {
        recordedByMembership: {
          select: { professionalProfile: { select: { displayName: true } } },
        },
      },
    });
    if (!row) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Hospitalization entry not found');
    return this.toEntry(row, row.recordedByMembership.professionalProfile?.displayName ?? null);
  }

  // Reads immutable parent identifiers before taking row locks in canonical order.
  private async requireSnapshot(tenant: TenantContext, hospitalizationId: string) {
    const snapshot = await this.prisma.hospitalization.findFirst({
      where: { id: hospitalizationId, organizationId: tenant.organizationId },
      select: { clinicalEncounterId: true, patientId: true },
    });
    if (!snapshot) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Hospitalization not found');
    return snapshot;
  }

  // Reads the aggregate again under parent and row locks to observe serialized lifecycle changes.
  private async requireLockedRecord(
    tx: Transaction,
    tenant: TenantContext,
    hospitalizationId: string,
  ): Promise<HospitalizationRecord> {
    const record = await tx.hospitalization.findFirst({
      where: { id: hospitalizationId, organizationId: tenant.organizationId },
      select: detailSelect,
    });
    if (!record) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Hospitalization not found');
    return record;
  }

  // Revalidates the actor from persisted active membership and user rows inside each mutation.
  private async requireActiveClinicalMembership(
    tx: Transaction,
    tenant: TenantContext,
    practitionerOnly: boolean,
  ) {
    const membership = await tx.membership.findFirst({
      where: {
        id: tenant.membershipId,
        organizationId: tenant.organizationId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true, clinicalRole: true },
    });
    if (
      !membership ||
      (practitionerOnly
        ? membership.clinicalRole !== ClinicalRole.PRACTITIONER
        : ![ClinicalRole.PRACTITIONER, ClinicalRole.CLINICAL_ASSISTANT].includes(
            membership.clinicalRole as ClinicalRole,
          ))
    ) {
      throw this.forbidden('INSUFFICIENT_PERMISSION', 'An active clinical membership is required');
    }
    return membership;
  }

  // Requires an active practitioner with a non-empty professional profile before admission.
  private async requireActivePractitioner(
    tx: Transaction,
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
        clinicalRole: ClinicalRole.PRACTITIONER,
      },
      select: {
        id: true,
        professionalProfile: { select: { displayName: true, licenseNumber: true } },
      },
    });
    if (!membership?.professionalProfile?.displayName.trim()) {
      throw this.conflict(
        'RESPONSIBLE_PRACTITIONER_REQUIRED',
        'Responsible practitioner needs an active profile',
      );
    }
    return membership;
  }

  // Blocks create/update/activate/entries/discharge after archive, but leaves reads and void history available.
  private async requirePatientStatus(
    tx: Transaction,
    organizationId: string,
    patientId: string,
    activeRequired: boolean,
  ): Promise<void> {
    const patient = await tx.patient.findFirst({
      where: { id: patientId, organizationId },
      select: { status: true },
    });
    if (!patient) throw this.notFound('HOSPITALIZATION_NOT_FOUND', 'Patient not found');
    if (activeRequired) this.requireActivePatient(patient.status);
  }

  private requireActivePatient(status: PatientStatus): void {
    if (status !== PatientStatus.ACTIVE)
      throw this.conflict(
        'PATIENT_ARCHIVED',
        'Archived patients cannot receive hospitalization changes',
      );
  }

  private requireEditableStatus(status: HospitalizationStatus): void {
    if (status === HospitalizationStatus.DISCHARGED || status === HospitalizationStatus.VOIDED) {
      throw this.conflict(
        'HOSPITALIZATION_IMMUTABLE',
        'Closed hospitalization records are immutable',
      );
    }
  }

  private requireParentNotVoided(status: ClinicalEncounterStatus): void {
    if (status === ClinicalEncounterStatus.VOIDED)
      throw this.conflict(
        'PARENT_CLINICAL_ENCOUNTER_VOIDED',
        'A voided encounter prevents this operation',
      );
  }

  private requirePractitionerActor(tenant: TenantContext): void {
    if (tenant.clinicalRole !== ClinicalRole.PRACTITIONER)
      throw this.forbidden('INSUFFICIENT_PERMISSION', 'A practitioner clinical role is required');
  }

  // These row locks serialize hospitalization operations against Encounter VOID and Patient archive.
  private async lockEncounter(
    tx: Transaction,
    organizationId: string,
    encounterId: string,
  ): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "clinical_encounters" WHERE "id" = ${encounterId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
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

  private async lockHospitalization(
    tx: Transaction,
    organizationId: string,
    hospitalizationId: string,
  ): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "hospitalizations" WHERE "id" = ${hospitalizationId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  private async lockOwner(tx: Transaction, organizationId: string, ownerId: string): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "owners" WHERE "id" = ${ownerId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  // Sorts and deduplicates membership locks to keep concurrent writers on a stable lock order.
  private async lockMemberships(
    tx: Transaction,
    organizationId: string,
    membershipIds: string[],
  ): Promise<void> {
    for (const membershipId of [...new Set(membershipIds)].sort()) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "memberships" WHERE "id" = ${membershipId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
      );
    }
  }

  // Audit metadata is structural only and deliberately excludes clinical content and measurements.
  private async audit(
    tx: Transaction,
    tenant: TenantContext,
    entityId: string,
    action:
      | 'HOSPITALIZATION_CREATED'
      | 'HOSPITALIZATION_UPDATED'
      | 'HOSPITALIZATION_ACTIVATED'
      | 'HOSPITALIZATION_ENTRY_ADDED'
      | 'HOSPITALIZATION_DISCHARGED'
      | 'HOSPITALIZATION_VOIDED',
    versionFrom: number,
    versionTo: number,
    status: HospitalizationStatus,
  ): Promise<void> {
    await tx.clinicalAuditEvent.create({
      data: {
        organizationId: tenant.organizationId,
        actorMembershipId: tenant.membershipId,
        entityType: 'HOSPITALIZATION',
        entityId,
        action,
        metadata: { versionFrom, versionTo, status },
      },
    });
  }

  private toSummary(record: HospitalizationRecord): HospitalizationSummary {
    return {
      id: record.id,
      clinicalEncounterId: record.clinicalEncounterId,
      patientId: record.patientId,
      status: record.status,
      version: record.version,
      admittedAt: record.admittedAt?.toISOString() ?? null,
      dischargedAt: record.dischargedAt?.toISOString() ?? null,
      locationName: record.locationName,
      admissionReason: record.admissionReason,
      diagnosis: record.diagnosis,
      patientNameSnapshot: record.patientNameSnapshot,
      ownerDisplayNameSnapshot: record.ownerDisplayNameSnapshot,
      professionalDisplayNameSnapshot: record.professionalDisplayNameSnapshot,
      professionalLicenseSnapshot: record.professionalLicenseSnapshot,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toDetail(record: HospitalizationRecord): HospitalizationDetail {
    return {
      ...this.toSummary(record),
      organizationId: record.organizationId,
      parentEncounterStatus: record.clinicalEncounter.status,
      responsiblePractitionerMembershipId: record.responsiblePractitionerMembershipId,
      createdByMembershipId: record.createdByMembershipId,
      activatedAt: record.activatedAt?.toISOString() ?? null,
      activatedByMembershipId: record.activatedByMembershipId,
      dischargedByMembershipId: record.dischargedByMembershipId,
      voidedAt: record.voidedAt?.toISOString() ?? null,
      voidedByMembershipId: record.voidedByMembershipId,
      voidReason: record.voidReason,
      treatmentPlan: record.treatmentPlan,
      medicationsText: record.medicationsText,
      dietInstructions: record.dietInstructions,
      dischargeSummary: record.dischargeSummary,
      dischargeRecommendations: record.dischargeRecommendations,
      notes: record.notes,
      entryCount: record._count.entries,
      patient: { id: record.patient.id, name: record.patient.name, status: record.patient.status },
    };
  }

  private toEntry(row: EntryRecord, recordedByDisplayName: string | null): HospitalizationEntry {
    return {
      id: row.id,
      hospitalizationId: row.hospitalizationId,
      entryType: row.entryType,
      recordedAt: row.recordedAt.toISOString(),
      content: row.content,
      temperatureC: row.temperatureC === null ? null : Number(row.temperatureC),
      heartRateBpm: row.heartRateBpm,
      respiratoryRatePerMinute: row.respiratoryRatePerMinute,
      weightKg: row.weightKg === null ? null : Number(row.weightKg),
      recordedByMembershipId: row.recordedByMembershipId,
      recordedByDisplayName,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private normalizeText(value: string | null | undefined): string | null | undefined {
    if (value === undefined || value === null) return value;
    const normalized = value.trim();
    return normalized || null;
  }

  private pagination(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private stale(): ConflictException {
    return this.conflict('HOSPITALIZATION_STALE', 'Hospitalization version is stale');
  }

  private invalidState(): ConflictException {
    return this.conflict(
      'INVALID_HOSPITALIZATION_STATE',
      'Operation is not allowed for this hospitalization status',
    );
  }

  private notFound(code: string, message: string): NotFoundException {
    return new NotFoundException({ code, message });
  }

  private conflict(code: string, message: string): ConflictException {
    return new ConflictException({ code, message });
  }

  private badRequest(code: string, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }

  private forbidden(code: string, message: string): ForbiddenException {
    return new ForbiddenException({ code, message });
  }
}
