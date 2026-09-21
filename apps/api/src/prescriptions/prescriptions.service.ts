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
  MembershipStatus,
  PatientStatus,
  Prisma,
  PrescriptionStatus,
  UserStatus,
} from '@prisma/client';
import type {
  PrescriptionDetail,
  PrescriptionListResponse,
  PrescriptionSummary,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  CreatePrescriptionDto,
  PrescriptionItemDto,
  PrescriptionListQueryDto,
  PrescriptionVersionDto,
  UpdatePrescriptionDto,
  VoidPrescriptionDto,
} from './prescription.dto';

type DomainDatabase = PrismaService | Prisma.TransactionClient;

const prescriptionSelect = {
  id: true,
  organizationId: true,
  clinicalEncounterId: true,
  patientId: true,
  status: true,
  version: true,
  prescribedByMembershipId: true,
  createdByMembershipId: true,
  professionalDisplayNameSnapshot: true,
  professionalLicenseSnapshot: true,
  patientNameSnapshot: true,
  ownerDisplayNameSnapshot: true,
  diagnosisSnapshot: true,
  finalizedAt: true,
  finalizedByMembershipId: true,
  voidedAt: true,
  voidedByMembershipId: true,
  voidReason: true,
  createdAt: true,
  updatedAt: true,
  patient: { select: { id: true, name: true, status: true } },
  clinicalEncounter: { select: { id: true, status: true } },
  prescribedByMembership: {
    select: {
      id: true,
      professionalProfile: { select: { displayName: true, licenseNumber: true } },
    },
  },
  items: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      prescriptionId: true,
      position: true,
      medicationName: true,
      presentation: true,
      quantity: true,
      dosage: true,
      frequency: true,
      duration: true,
      observations: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PrescriptionSelect;

type PrescriptionRecord = Prisma.PrescriptionGetPayload<{ select: typeof prescriptionSelect }>;

function notFound(code: string, message: string): NotFoundException {
  return new NotFoundException({ code, message });
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function validation(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

function forbidden(code: string, message: string): ForbiddenException {
  return new ForbiddenException({ code, message });
}

function trimmedNullable(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const result = value.trim();
  return result.length ? result : null;
}

function normalizedItems(input: PrescriptionItemDto[] | undefined) {
  const items = input ?? [];
  const positions = new Set<number>();
  return items.map((item) => {
    if (positions.has(item.position)) {
      throw validation('Prescription item positions must be unique');
    }
    positions.add(item.position);
    return {
      position: item.position,
      medicationName: item.medicationName.trim(),
      presentation: trimmedNullable(item.presentation),
      quantity: trimmedNullable(item.quantity),
      dosage: trimmedNullable(item.dosage),
      frequency: trimmedNullable(item.frequency),
      duration: trimmedNullable(item.duration),
      observations: trimmedNullable(item.observations),
    };
  });
}

// PrescriptionService owns the satellite lifecycle, tenant invariants and CAS transactions.
@Injectable()
export class PrescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: PrescriptionListQueryDto,
  ): Promise<PrescriptionListResponse> {
    await this.requirePatient(this.prisma, tenant.organizationId, patientId, false);
    const where: Prisma.PrescriptionWhereInput = {
      organizationId: tenant.organizationId,
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clinicalEncounterId ? { clinicalEncounterId: query.clinicalEncounterId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        select: prescriptionSelect,
        orderBy: [
          { finalizedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.prescription.count({ where }),
    ]);
    return {
      data: data.map((item) => this.toSummary(item)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  async findOne(tenant: TenantContext, prescriptionId: string): Promise<PrescriptionDetail> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, organizationId: tenant.organizationId },
      select: prescriptionSelect,
    });
    if (!prescription) throw notFound('PRESCRIPTION_NOT_FOUND', 'Prescription not found');
    return this.toDetail(prescription);
  }

  async create(
    tenant: TenantContext,
    clinicalEncounterId: string,
    input: CreatePrescriptionDto,
  ): Promise<PrescriptionDetail> {
    const createdId = await this.prisma.$transaction(async (tx) => {
      const encounter = await this.requireParentEncounter(
        tx,
        tenant.organizationId,
        clinicalEncounterId,
      );
      await this.requirePatient(tx, tenant.organizationId, encounter.patientId, true);
      if (input.prescribedByMembershipId) {
        await this.requirePrescriber(tx, tenant.organizationId, input.prescribedByMembershipId);
      }
      const items = normalizedItems(input.items);
      const created = await tx.prescription.create({
        data: {
          organizationId: tenant.organizationId,
          clinicalEncounterId,
          patientId: encounter.patientId,
          prescribedByMembershipId: input.prescribedByMembershipId ?? null,
          createdByMembershipId: tenant.membershipId,
          items: { create: items },
        },
        select: { id: true },
      });
      await this.createAudit(tx, tenant, created.id, 'PRESCRIPTION_CREATED', {
        itemCount: items.length,
        newVersion: 1,
      });
      return created.id;
    });
    return this.findOne(tenant, createdId);
  }

  async updateDraft(
    tenant: TenantContext,
    prescriptionId: string,
    input: UpdatePrescriptionDto,
  ): Promise<PrescriptionDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.requirePrescription(tx, tenant.organizationId, prescriptionId);
      if (current.status !== PrescriptionStatus.DRAFT) {
        throw conflict('PRESCRIPTION_IMMUTABLE', 'Only draft prescriptions can be edited');
      }
      if (current.version !== input.expectedVersion) {
        throw conflict('PRESCRIPTION_STALE', 'Prescription version is stale');
      }
      await this.requireParentEncounter(tx, tenant.organizationId, current.clinicalEncounterId);
      await this.requirePatient(tx, tenant.organizationId, current.patientId, true);
      if (input.prescribedByMembershipId) {
        await this.requirePrescriber(tx, tenant.organizationId, input.prescribedByMembershipId);
      }
      const items = normalizedItems(input.items);
      const result = await tx.prescription.updateMany({
        where: {
          id: prescriptionId,
          organizationId: tenant.organizationId,
          status: PrescriptionStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          prescribedByMembershipId:
            input.prescribedByMembershipId === undefined
              ? current.prescribedByMembershipId
              : input.prescribedByMembershipId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw conflict('PRESCRIPTION_STALE', 'Prescription version is stale');
      }
      await tx.prescriptionItem.deleteMany({ where: { prescriptionId } });
      if (items.length) {
        await tx.prescriptionItem.createMany({
          data: items.map((item) => ({ prescriptionId, ...item })),
        });
      }
      await this.createAudit(tx, tenant, prescriptionId, 'PRESCRIPTION_UPDATED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
        itemCount: items.length,
      });
    });
    return this.findOne(tenant, prescriptionId);
  }

  async finalize(
    tenant: TenantContext,
    prescriptionId: string,
    input: PrescriptionVersionDto,
  ): Promise<PrescriptionDetail> {
    const actor = await this.requirePractitionerActor(tenant);
    await this.prisma.$transaction(async (tx) => {
      const current = await this.requirePrescription(tx, tenant.organizationId, prescriptionId);
      if (current.status !== PrescriptionStatus.DRAFT) {
        throw conflict('INVALID_PRESCRIPTION_STATE', 'Only draft prescriptions can be finalized');
      }
      if (current.version !== input.expectedVersion) {
        throw conflict('PRESCRIPTION_STALE', 'Prescription version is stale');
      }
      const encounter = await this.requireParentEncounter(
        tx,
        tenant.organizationId,
        current.clinicalEncounterId,
      );
      const patient = await this.requirePatient(tx, tenant.organizationId, current.patientId, true);
      if (!current.prescribedByMembershipId) {
        throw conflict('PRESCRIBER_REQUIRED', 'A prescribing practitioner is required');
      }
      if (actor.membershipId !== current.prescribedByMembershipId) {
        throw conflict(
          'ONLY_PRESCRIBER_CAN_FINALIZE',
          'Only the prescribed practitioner can finalize this prescription',
        );
      }
      const prescriber = await this.requirePrescriber(
        tx,
        tenant.organizationId,
        current.prescribedByMembershipId,
      );
      if (!prescriber.professionalProfile?.displayName.trim()) {
        throw conflict('PRESCRIBER_PROFILE_REQUIRED', 'A professional profile is required');
      }
      const items = await tx.prescriptionItem.findMany({
        where: { prescriptionId },
        select: { position: true, medicationName: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
      this.validateFinalItems(items);
      const owner = await tx.owner.findFirst({
        where: { id: encounter.ownerIdAtTime, organizationId: tenant.organizationId },
        select: { firstName: true, lastName: true },
      });
      if (!owner) throw notFound('RESOURCE_NOT_FOUND', 'Historical owner not found');
      const diagnosisSnapshot = this.buildDiagnosisSnapshot(encounter);
      const now = new Date();
      const result = await tx.prescription.updateMany({
        where: {
          id: prescriptionId,
          organizationId: tenant.organizationId,
          status: PrescriptionStatus.DRAFT,
          version: input.expectedVersion,
        },
        data: {
          status: PrescriptionStatus.FINALIZED,
          professionalDisplayNameSnapshot: prescriber.professionalProfile.displayName.trim(),
          professionalLicenseSnapshot: prescriber.professionalProfile.licenseNumber?.trim() || null,
          patientNameSnapshot: patient.name,
          ownerDisplayNameSnapshot: [owner.firstName, owner.lastName].filter(Boolean).join(' '),
          diagnosisSnapshot,
          finalizedAt: now,
          finalizedByMembershipId: tenant.membershipId,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw conflict('PRESCRIPTION_STALE', 'Prescription version is stale');
      }
      await this.createAudit(tx, tenant, prescriptionId, 'PRESCRIPTION_FINALIZED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
        itemCount: items.length,
      });
    });
    return this.findOne(tenant, prescriptionId);
  }

  async void(
    tenant: TenantContext,
    prescriptionId: string,
    input: VoidPrescriptionDto,
  ): Promise<PrescriptionDetail> {
    await this.requirePractitionerActor(tenant);
    await this.prisma.$transaction(async (tx) => {
      const current = await this.requirePrescription(tx, tenant.organizationId, prescriptionId);
      if (current.status !== PrescriptionStatus.FINALIZED) {
        throw conflict('INVALID_PRESCRIPTION_STATE', 'Only finalized prescriptions can be voided');
      }
      if (current.version !== input.expectedVersion) {
        throw conflict('PRESCRIPTION_STALE', 'Prescription version is stale');
      }
      const reason = input.reason.trim();
      if (!reason) throw validation('reason is required');
      const result = await tx.prescription.updateMany({
        where: {
          id: prescriptionId,
          organizationId: tenant.organizationId,
          status: PrescriptionStatus.FINALIZED,
          version: input.expectedVersion,
        },
        data: {
          status: PrescriptionStatus.VOIDED,
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw conflict('PRESCRIPTION_STALE', 'Prescription version is stale');
      }
      await this.createAudit(tx, tenant, prescriptionId, 'PRESCRIPTION_VOIDED', {
        previousVersion: input.expectedVersion,
        newVersion: input.expectedVersion + 1,
        reasonProvided: true,
      });
    });
    return this.findOne(tenant, prescriptionId);
  }

  private async requireParentEncounter(
    database: DomainDatabase,
    organizationId: string,
    encounterId: string,
  ) {
    const encounter = await database.clinicalEncounter.findFirst({
      where: { id: encounterId, organizationId },
      select: {
        id: true,
        organizationId: true,
        patientId: true,
        ownerIdAtTime: true,
        status: true,
        presumptiveDiagnosis: true,
        differentialDiagnosis: true,
        definitiveDiagnosis: true,
      },
    });
    if (!encounter) throw notFound('CLINICAL_ENCOUNTER_NOT_FOUND', 'Clinical encounter not found');
    if (encounter.status === ClinicalEncounterStatus.VOIDED) {
      throw conflict('PARENT_CLINICAL_ENCOUNTER_VOIDED', 'The parent clinical encounter is voided');
    }
    if (
      encounter.status !== ClinicalEncounterStatus.DRAFT &&
      encounter.status !== ClinicalEncounterStatus.FINALIZED
    ) {
      throw conflict('INVALID_CLINICAL_ENCOUNTER_STATE', 'The parent encounter is not eligible');
    }
    return encounter;
  }

  private async requirePrescription(
    database: DomainDatabase,
    organizationId: string,
    prescriptionId: string,
  ) {
    const prescription = await database.prescription.findFirst({
      where: { id: prescriptionId, organizationId },
      select: {
        id: true,
        organizationId: true,
        clinicalEncounterId: true,
        patientId: true,
        status: true,
        version: true,
        prescribedByMembershipId: true,
      },
    });
    if (!prescription) throw notFound('PRESCRIPTION_NOT_FOUND', 'Prescription not found');
    return prescription;
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
      select: { id: true, name: true, ownerId: true, status: true },
    });
    if (!patient) throw notFound('RESOURCE_NOT_FOUND', 'Patient not found');
    return patient;
  }

  private async requirePrescriber(
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
      select: {
        id: true,
        clinicalRole: true,
        professionalProfile: { select: { displayName: true, licenseNumber: true } },
      },
    });
    if (!membership) throw notFound('PRESCRIBER_NOT_FOUND', 'Prescribing membership not found');
    if (membership.clinicalRole !== ClinicalRole.PRACTITIONER) {
      throw conflict('PRESCRIBER_REQUIRED', 'The prescriber must be a practitioner');
    }
    return membership;
  }

  private async requirePractitionerActor(tenant: TenantContext): Promise<TenantContext> {
    if (tenant.clinicalRole !== ClinicalRole.PRACTITIONER) {
      throw forbidden('INSUFFICIENT_PERMISSION', 'A practitioner clinical role is required');
    }
    return tenant;
  }

  private validateFinalItems(items: Array<{ position: number; medicationName: string }>): void {
    if (!items.length) {
      throw conflict('PRESCRIPTION_ITEMS_REQUIRED', 'At least one prescription item is required');
    }
    const positions = new Set<number>();
    for (const item of items) {
      if (positions.has(item.position)) {
        throw conflict('PRESCRIPTION_ITEMS_REQUIRED', 'Prescription item positions must be unique');
      }
      positions.add(item.position);
      if (!item.medicationName.trim()) {
        throw conflict('PRESCRIPTION_ITEMS_REQUIRED', 'Every item needs a medication name');
      }
    }
  }

  private buildDiagnosisSnapshot(encounter: {
    presumptiveDiagnosis: string | null;
    differentialDiagnosis: string | null;
    definitiveDiagnosis: string | null;
  }): string | null {
    const sections = [
      ['Presuntivo', encounter.presumptiveDiagnosis],
      ['Diferencial', encounter.differentialDiagnosis],
      ['Definitivo', encounter.definitiveDiagnosis],
    ]
      .map(([label, value]) => (value?.trim() ? `${label}: ${value.trim()}` : null))
      .filter((value): value is string => Boolean(value));
    return sections.length ? sections.join('\n') : null;
  }

  private async createAudit(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    entityId: string,
    action:
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
        entityType: 'PRESCRIPTION',
        entityId,
        action,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private toSummary(record: PrescriptionRecord): PrescriptionSummary {
    return {
      id: record.id,
      organizationId: record.organizationId,
      clinicalEncounterId: record.clinicalEncounterId,
      patientId: record.patientId,
      status: record.status,
      itemCount: record.items.length,
      version: record.version,
      prescribedByMembershipId: record.prescribedByMembershipId,
      createdByMembershipId: record.createdByMembershipId,
      professionalDisplayNameSnapshot: record.professionalDisplayNameSnapshot,
      professionalLicenseSnapshot: record.professionalLicenseSnapshot,
      patientNameSnapshot: record.patientNameSnapshot,
      ownerDisplayNameSnapshot: record.ownerDisplayNameSnapshot,
      diagnosisSnapshot: record.diagnosisSnapshot,
      finalizedAt: record.finalizedAt?.toISOString() ?? null,
      finalizedByMembershipId: record.finalizedByMembershipId,
      voidedAt: record.voidedAt?.toISOString() ?? null,
      voidedByMembershipId: record.voidedByMembershipId,
      voidReason: record.voidReason,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      parentEncounterStatus: record.clinicalEncounter.status,
      patient: record.patient,
      prescribedBy: record.prescribedByMembership
        ? {
            membershipId: record.prescribedByMembership.id,
            displayName: record.prescribedByMembership.professionalProfile?.displayName ?? null,
            licenseNumber: record.prescribedByMembership.professionalProfile?.licenseNumber ?? null,
          }
        : null,
    };
  }

  private toDetail(record: PrescriptionRecord): PrescriptionDetail {
    return {
      ...this.toSummary(record),
      items: record.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  }

  private pagination(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}
