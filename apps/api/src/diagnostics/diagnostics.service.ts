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
  DiagnosticOrderStatus,
  MembershipStatus,
  PatientStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type {
  DiagnosticOrderDetail,
  DiagnosticOrderListResponse,
  DiagnosticOrderSummary,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  CreateDiagnosticOrderDto,
  DiagnosticOrderListQueryDto,
  ResultDiagnosticOrderDto,
  UpdateDiagnosticOrderDto,
  VoidDiagnosticOrderDto,
} from './diagnostic.dto';

type Transaction = Prisma.TransactionClient;

const professionalSelect = {
  id: true,
  professionalProfile: { select: { displayName: true, licenseNumber: true } },
} satisfies Prisma.MembershipSelect;

const orderSelect = {
  id: true,
  organizationId: true,
  clinicalEncounterId: true,
  patientId: true,
  category: true,
  status: true,
  version: true,
  testName: true,
  requestedAt: true,
  reason: true,
  instructions: true,
  notes: true,
  responsiblePractitionerMembershipId: true,
  createdByMembershipId: true,
  patientNameSnapshot: true,
  ownerDisplayNameSnapshot: true,
  professionalDisplayNameSnapshot: true,
  professionalLicenseSnapshot: true,
  requestedByMembershipId: true,
  resultedAt: true,
  resultText: true,
  interpretation: true,
  resultedByMembershipId: true,
  voidedAt: true,
  voidedByMembershipId: true,
  voidReason: true,
  createdAt: true,
  updatedAt: true,
  clinicalEncounter: {
    select: { status: true, occurredAt: true, reason: true, ownerIdAtTime: true },
  },
  patient: { select: { id: true, name: true, status: true } },
  responsiblePractitionerMembership: { select: professionalSelect },
  requestedByMembership: { select: professionalSelect },
  resultedByMembership: { select: professionalSelect },
  voidedByMembership: { select: professionalSelect },
} satisfies Prisma.DiagnosticOrderSelect;

type OrderRecord = Prisma.DiagnosticOrderGetPayload<{ select: typeof orderSelect }>;

// Owns tenant-scoped diagnostic request/result lifecycle, CAS, row locks and audit records.
@Injectable()
export class DiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Lists a patient's diagnostic history and includes undated Drafts when no date range is supplied.
  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: DiagnosticOrderListQueryDto,
  ): Promise<DiagnosticOrderListResponse> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!patient) throw this.notFound('DIAGNOSTIC_ORDER_NOT_FOUND', 'Patient not found');
    if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
      throw this.badRequest('VALIDATION_ERROR', 'from must be on or before to');
    }
    const where: Prisma.DiagnosticOrderWhereInput = {
      organizationId: tenant.organizationId,
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.clinicalEncounterId ? { clinicalEncounterId: query.clinicalEncounterId } : {}),
      ...(query.from || query.to
        ? {
            requestedAt: {
              not: null,
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.diagnosticOrder.findMany({
        where,
        select: orderSelect,
        orderBy: [
          { requestedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.diagnosticOrder.count({ where }),
    ]);
    return {
      data: records.map((record) => this.toSummary(record)),
      pagination: this.pagination(query.page, query.pageSize, total),
    };
  }

  // Historical results stay readable after patient archive or encounter void.
  async findOne(tenant: TenantContext, diagnosticOrderId: string): Promise<DiagnosticOrderDetail> {
    const record = await this.prisma.diagnosticOrder.findFirst({
      where: { id: diagnosticOrderId, organizationId: tenant.organizationId },
      select: orderSelect,
    });
    if (!record) throw this.notFound('DIAGNOSTIC_ORDER_NOT_FOUND', 'Diagnostic order not found');
    return this.toDetail(record);
  }

  // Creates an editable Draft only for an active Patient and a non-voided Encounter.
  async create(
    tenant: TenantContext,
    encounterId: string,
    input: CreateDiagnosticOrderDto,
  ): Promise<DiagnosticOrderDetail> {
    const orderId = await this.prisma.$transaction(async (tx) => {
      await this.lockEncounter(tx, tenant.organizationId, encounterId);
      const encounter = await tx.clinicalEncounter.findFirst({
        where: { id: encounterId, organizationId: tenant.organizationId },
        select: { patientId: true, status: true },
      });
      if (!encounter)
        throw this.notFound('DIAGNOSTIC_ORDER_NOT_FOUND', 'Clinical encounter not found');
      await this.lockPatient(tx, tenant.organizationId, encounter.patientId);
      await this.requirePatientActive(tx, tenant.organizationId, encounter.patientId);
      this.requireEncounterWritable(encounter.status);
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        ...(input.responsiblePractitionerMembershipId
          ? [input.responsiblePractitionerMembershipId]
          : []),
      ]);
      await this.requireActiveClinicalActor(tx, tenant);
      if (input.responsiblePractitionerMembershipId) {
        await this.requireDraftResponsiblePractitioner(
          tx,
          tenant.organizationId,
          input.responsiblePractitionerMembershipId,
        );
      }
      const record = await tx.diagnosticOrder.create({
        data: {
          organizationId: tenant.organizationId,
          clinicalEncounterId: encounterId,
          patientId: encounter.patientId,
          category: input.category,
          testName: this.normalizeText(input.testName) ?? null,
          requestedAt: input.requestedAt ? new Date(input.requestedAt) : null,
          reason: this.normalizeText(input.reason) ?? null,
          instructions: this.normalizeText(input.instructions) ?? null,
          notes: this.normalizeText(input.notes) ?? null,
          responsiblePractitionerMembershipId: input.responsiblePractitionerMembershipId ?? null,
          createdByMembershipId: tenant.membershipId,
        },
        select: { id: true },
      });
      await this.audit(tx, tenant, record.id, 'DIAGNOSTIC_ORDER_CREATED', 0, 1, 'DRAFT');
      return record.id;
    });
    return this.findOne(tenant, orderId);
  }

  // Draft edits serialize against encounter void and patient archive before performing a CAS update.
  async updateDraft(
    tenant: TenantContext,
    diagnosticOrderId: string,
    input: UpdateDiagnosticOrderDto,
  ): Promise<DiagnosticOrderDetail> {
    await this.prisma.$transaction(async (tx) => {
      const locator = await this.requireLocator(tx, tenant, diagnosticOrderId);
      await this.lockEncounter(tx, tenant.organizationId, locator.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, locator.patientId);
      await this.lockDiagnosticOrder(tx, tenant.organizationId, diagnosticOrderId);
      const current = await this.requireLockedRecord(tx, tenant, diagnosticOrderId);
      await this.requirePatientActive(tx, tenant.organizationId, current.patientId);
      this.requireEncounterWritable(current.clinicalEncounter.status);
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        ...(input.responsiblePractitionerMembershipId
          ? [input.responsiblePractitionerMembershipId]
          : []),
      ]);
      await this.requireActiveClinicalActor(tx, tenant);
      if (current.version !== input.expectedVersion) throw this.stale();
      if (current.status !== DiagnosticOrderStatus.DRAFT) throw this.immutable();
      if (
        input.responsiblePractitionerMembershipId !== undefined &&
        input.responsiblePractitionerMembershipId !== null
      ) {
        await this.requireDraftResponsiblePractitioner(
          tx,
          tenant.organizationId,
          input.responsiblePractitionerMembershipId,
        );
      }
      const data: Prisma.DiagnosticOrderUncheckedUpdateManyInput = {
        version: { increment: 1 },
      };
      if (input.category !== undefined) data.category = input.category;
      if (input.testName !== undefined) data.testName = this.normalizeText(input.testName) ?? null;
      if (input.requestedAt !== undefined) {
        data.requestedAt = input.requestedAt === null ? null : new Date(input.requestedAt);
      }
      if (input.reason !== undefined) data.reason = this.normalizeText(input.reason) ?? null;
      if (input.instructions !== undefined)
        data.instructions = this.normalizeText(input.instructions) ?? null;
      if (input.notes !== undefined) data.notes = this.normalizeText(input.notes) ?? null;
      if (input.responsiblePractitionerMembershipId !== undefined) {
        data.responsiblePractitionerMembershipId = input.responsiblePractitionerMembershipId;
      }
      const updated = await tx.diagnosticOrder.updateMany({
        where: {
          id: diagnosticOrderId,
          organizationId: tenant.organizationId,
          status: DiagnosticOrderStatus.DRAFT,
          version: input.expectedVersion,
        },
        data,
      });
      if (updated.count !== 1) throw this.stale();
      await this.audit(
        tx,
        tenant,
        diagnosticOrderId,
        'DIAGNOSTIC_ORDER_UPDATED',
        input.expectedVersion,
        input.expectedVersion + 1,
        'DRAFT',
      );
    });
    return this.findOne(tenant, diagnosticOrderId);
  }

  // Request freezes historical context and can only be authored by the assigned Practitioner.
  async request(
    tenant: TenantContext,
    diagnosticOrderId: string,
    expectedVersion: number,
  ): Promise<DiagnosticOrderDetail> {
    await this.prisma.$transaction(async (tx) => {
      const locator = await this.requireLocator(tx, tenant, diagnosticOrderId);
      await this.lockEncounter(tx, tenant.organizationId, locator.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, locator.patientId);
      await this.lockDiagnosticOrder(tx, tenant.organizationId, diagnosticOrderId);
      const current = await this.requireLockedRecord(tx, tenant, diagnosticOrderId);
      await this.requirePatientActive(tx, tenant.organizationId, current.patientId);
      this.requireEncounterWritable(current.clinicalEncounter.status);
      if (current.version !== expectedVersion) throw this.stale();
      if (current.status !== DiagnosticOrderStatus.DRAFT) throw this.invalidState();
      if (!current.testName?.trim() || !current.requestedAt) {
        throw this.conflict(
          'DIAGNOSTIC_ORDER_REQUEST_INCOMPLETE',
          'A test name and requested date are required before requesting',
        );
      }
      if (!current.responsiblePractitionerMembershipId) {
        throw this.conflict(
          'RESPONSIBLE_PRACTITIONER_REQUIRED',
          'A responsible Practitioner is required before requesting',
        );
      }
      if (current.responsiblePractitionerMembershipId !== tenant.membershipId) {
        throw this.forbidden(
          'ONLY_RESPONSIBLE_PRACTITIONER_CAN_REQUEST',
          'Only the assigned Practitioner can request this diagnostic order',
        );
      }
      await this.lockOwner(tx, tenant.organizationId, current.clinicalEncounter.ownerIdAtTime);
      await this.lockMemberships(tx, tenant.organizationId, [
        tenant.membershipId,
        current.responsiblePractitionerMembershipId,
      ]);
      const requester = await this.requireActivePractitioner(
        tx,
        tenant.organizationId,
        tenant.membershipId,
      );
      const [patient, owner] = await Promise.all([
        tx.patient.findFirst({
          where: { id: current.patientId, organizationId: tenant.organizationId },
          select: { name: true },
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
        throw this.notFound('DIAGNOSTIC_ORDER_NOT_FOUND', 'Historical clinical context not found');
      const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
      const updated = await tx.diagnosticOrder.updateMany({
        where: {
          id: diagnosticOrderId,
          organizationId: tenant.organizationId,
          status: DiagnosticOrderStatus.DRAFT,
          version: expectedVersion,
        },
        data: {
          status: DiagnosticOrderStatus.REQUESTED,
          requestedByMembershipId: tenant.membershipId,
          patientNameSnapshot: patient.name,
          ownerDisplayNameSnapshot: ownerName,
          professionalDisplayNameSnapshot: requester.professionalProfile.displayName.trim(),
          professionalLicenseSnapshot:
            this.normalizeText(requester.professionalProfile.licenseNumber) ?? null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.stale();
      await this.audit(
        tx,
        tenant,
        diagnosticOrderId,
        'DIAGNOSTIC_ORDER_REQUESTED',
        expectedVersion,
        expectedVersion + 1,
        'REQUESTED',
      );
    });
    return this.findOne(tenant, diagnosticOrderId);
  }

  // Results are recorded by any active Practitioner with diagnostics.result permission.
  async result(
    tenant: TenantContext,
    diagnosticOrderId: string,
    input: ResultDiagnosticOrderDto,
  ): Promise<DiagnosticOrderDetail> {
    const resultText = this.normalizeText(input.resultText);
    const interpretation = this.normalizeText(input.interpretation);
    if (!resultText && !interpretation) {
      throw this.badRequest(
        'DIAGNOSTIC_ORDER_RESULT_EMPTY',
        'Result text or interpretation is required',
      );
    }
    const resultedAt = new Date(input.resultedAt);
    if (!Number.isFinite(resultedAt.getTime())) {
      throw this.badRequest('VALIDATION_ERROR', 'A valid result date is required');
    }
    await this.prisma.$transaction(async (tx) => {
      const locator = await this.requireLocator(tx, tenant, diagnosticOrderId);
      await this.lockEncounter(tx, tenant.organizationId, locator.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, locator.patientId);
      await this.lockDiagnosticOrder(tx, tenant.organizationId, diagnosticOrderId);
      const current = await this.requireLockedRecord(tx, tenant, diagnosticOrderId);
      await this.requirePatientActive(tx, tenant.organizationId, current.patientId);
      this.requireEncounterWritable(current.clinicalEncounter.status);
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requireActivePractitioner(tx, tenant.organizationId, tenant.membershipId);
      if (current.version !== input.expectedVersion) throw this.stale();
      if (current.status !== DiagnosticOrderStatus.REQUESTED) throw this.invalidState();
      const updated = await tx.diagnosticOrder.updateMany({
        where: {
          id: diagnosticOrderId,
          organizationId: tenant.organizationId,
          status: DiagnosticOrderStatus.REQUESTED,
          version: input.expectedVersion,
        },
        data: {
          status: DiagnosticOrderStatus.RESULTED,
          resultedAt,
          resultText: resultText ?? null,
          interpretation: interpretation ?? null,
          resultedByMembershipId: tenant.membershipId,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.stale();
      await this.audit(
        tx,
        tenant,
        diagnosticOrderId,
        'DIAGNOSTIC_ORDER_RESULTED',
        input.expectedVersion,
        input.expectedVersion + 1,
        'RESULTED',
      );
    });
    return this.findOne(tenant, diagnosticOrderId);
  }

  // Void preserves the request and optional result while allowing correction after parent/patient closure.
  async void(
    tenant: TenantContext,
    diagnosticOrderId: string,
    input: VoidDiagnosticOrderDto,
  ): Promise<DiagnosticOrderDetail> {
    const reason = this.normalizeText(input.reason);
    if (!reason) throw this.badRequest('VALIDATION_ERROR', 'A void reason is required');
    await this.prisma.$transaction(async (tx) => {
      const locator = await this.requireLocator(tx, tenant, diagnosticOrderId);
      await this.lockEncounter(tx, tenant.organizationId, locator.clinicalEncounterId);
      await this.lockPatient(tx, tenant.organizationId, locator.patientId);
      await this.lockDiagnosticOrder(tx, tenant.organizationId, diagnosticOrderId);
      const current = await this.requireLockedRecord(tx, tenant, diagnosticOrderId);
      await this.lockMemberships(tx, tenant.organizationId, [tenant.membershipId]);
      await this.requireActivePractitioner(tx, tenant.organizationId, tenant.membershipId);
      if (current.version !== input.expectedVersion) throw this.stale();
      if (
        current.status !== DiagnosticOrderStatus.REQUESTED &&
        current.status !== DiagnosticOrderStatus.RESULTED
      ) {
        throw this.invalidState();
      }
      const updated = await tx.diagnosticOrder.updateMany({
        where: {
          id: diagnosticOrderId,
          organizationId: tenant.organizationId,
          status: current.status,
          version: input.expectedVersion,
        },
        data: {
          status: DiagnosticOrderStatus.VOIDED,
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw this.stale();
      await this.audit(
        tx,
        tenant,
        diagnosticOrderId,
        'DIAGNOSTIC_ORDER_VOIDED',
        input.expectedVersion,
        input.expectedVersion + 1,
        'VOIDED',
      );
    });
    return this.findOne(tenant, diagnosticOrderId);
  }

  // Locator reads are revalidated under the required parent-to-child lock order.
  private async requireLocator(tx: Transaction, tenant: TenantContext, diagnosticOrderId: string) {
    const locator = await tx.diagnosticOrder.findFirst({
      where: { id: diagnosticOrderId, organizationId: tenant.organizationId },
      select: { clinicalEncounterId: true, patientId: true },
    });
    if (!locator) throw this.notFound('DIAGNOSTIC_ORDER_NOT_FOUND', 'Diagnostic order not found');
    return locator;
  }

  private async requireLockedRecord(
    tx: Transaction,
    tenant: TenantContext,
    diagnosticOrderId: string,
  ): Promise<OrderRecord> {
    const record = await tx.diagnosticOrder.findFirst({
      where: { id: diagnosticOrderId, organizationId: tenant.organizationId },
      select: orderSelect,
    });
    if (!record) throw this.notFound('DIAGNOSTIC_ORDER_NOT_FOUND', 'Diagnostic order not found');
    return record;
  }

  private async requirePatientActive(
    tx: Transaction,
    organizationId: string,
    patientId: string,
  ): Promise<void> {
    const patient = await tx.patient.findFirst({
      where: { id: patientId, organizationId },
      select: { status: true },
    });
    if (!patient) throw this.notFound('DIAGNOSTIC_ORDER_NOT_FOUND', 'Patient not found');
    if (patient.status !== PatientStatus.ACTIVE) {
      throw this.conflict(
        'PATIENT_ARCHIVED',
        'Archived patients cannot receive diagnostic updates',
      );
    }
  }

  private async requireActiveClinicalActor(tx: Transaction, tenant: TenantContext): Promise<void> {
    const membership = await tx.membership.findFirst({
      where: {
        id: tenant.membershipId,
        organizationId: tenant.organizationId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
        clinicalRole: { in: [ClinicalRole.PRACTITIONER, ClinicalRole.CLINICAL_ASSISTANT] },
      },
      select: { id: true },
    });
    if (!membership)
      throw this.forbidden('INSUFFICIENT_PERMISSION', 'An active clinical membership is required');
  }

  private async requireActivePractitioner(
    tx: Transaction,
    organizationId: string,
    membershipId: string,
  ): Promise<{
    id: string;
    professionalProfile: { displayName: string; licenseNumber: string | null };
  }> {
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
    if (
      !membership ||
      !membership.professionalProfile ||
      !membership.professionalProfile.displayName.trim()
    ) {
      throw this.conflict(
        'RESPONSIBLE_PRACTITIONER_REQUIRED',
        'An active Practitioner profile with a display name is required',
      );
    }
    return { id: membership.id, professionalProfile: membership.professionalProfile };
  }

  private async requireDraftResponsiblePractitioner(
    tx: Transaction,
    organizationId: string,
    membershipId: string,
  ): Promise<void> {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
        clinicalRole: ClinicalRole.PRACTITIONER,
      },
      select: { id: true },
    });
    if (!membership) {
      throw this.conflict(
        'RESPONSIBLE_PRACTITIONER_REQUIRED',
        'Responsible membership must be an active Practitioner',
      );
    }
  }

  private requireEncounterWritable(status: ClinicalEncounterStatus): void {
    if (status === ClinicalEncounterStatus.VOIDED) {
      throw this.conflict(
        'PARENT_CLINICAL_ENCOUNTER_VOIDED',
        'A voided encounter prevents this diagnostic order operation',
      );
    }
  }

  // Row locks serialize order writes with encounter void, patient archive, and other order mutations.
  private async lockEncounter(tx: Transaction, organizationId: string, encounterId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "clinical_encounters" WHERE "id" = ${encounterId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  private async lockPatient(tx: Transaction, organizationId: string, patientId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "patients" WHERE "id" = ${patientId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  private async lockDiagnosticOrder(tx: Transaction, organizationId: string, orderId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "diagnostic_orders" WHERE "id" = ${orderId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  private async lockOwner(tx: Transaction, organizationId: string, ownerId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "owners" WHERE "id" = ${ownerId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
    );
  }

  // Membership locks are sorted and deduplicated after parent, Patient, order, and Owner locks.
  private async lockMemberships(tx: Transaction, organizationId: string, membershipIds: string[]) {
    for (const membershipId of [...new Set(membershipIds)].sort()) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "memberships" WHERE "id" = ${membershipId}::uuid AND "organization_id" = ${organizationId}::uuid FOR UPDATE`,
      );
    }
  }

  // Audit metadata contains lifecycle structure only; clinical text and snapshots stay in the aggregate.
  private async audit(
    tx: Transaction,
    tenant: TenantContext,
    entityId: string,
    action:
      | 'DIAGNOSTIC_ORDER_CREATED'
      | 'DIAGNOSTIC_ORDER_UPDATED'
      | 'DIAGNOSTIC_ORDER_REQUESTED'
      | 'DIAGNOSTIC_ORDER_RESULTED'
      | 'DIAGNOSTIC_ORDER_VOIDED',
    versionFrom: number,
    versionTo: number,
    status: DiagnosticOrderStatus,
  ) {
    await tx.clinicalAuditEvent.create({
      data: {
        organizationId: tenant.organizationId,
        actorMembershipId: tenant.membershipId,
        entityType: 'DIAGNOSTIC_ORDER',
        entityId,
        action,
        metadata: { versionFrom, versionTo, status },
      },
    });
  }

  private toSummary(record: OrderRecord): DiagnosticOrderSummary {
    return {
      id: record.id,
      organizationId: record.organizationId,
      clinicalEncounterId: record.clinicalEncounterId,
      patientId: record.patientId,
      category: record.category,
      status: record.status,
      version: record.version,
      testName: record.testName,
      requestedAt: record.requestedAt?.toISOString() ?? null,
      responsiblePractitionerMembershipId: record.responsiblePractitionerMembershipId,
      createdByMembershipId: record.createdByMembershipId,
      patientNameSnapshot: record.patientNameSnapshot,
      ownerDisplayNameSnapshot: record.ownerDisplayNameSnapshot,
      professionalDisplayNameSnapshot: record.professionalDisplayNameSnapshot,
      professionalLicenseSnapshot: record.professionalLicenseSnapshot,
      requestedByMembershipId: record.requestedByMembershipId,
      resultedAt: record.resultedAt?.toISOString() ?? null,
      voidedAt: record.voidedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      parentEncounterStatus: record.clinicalEncounter.status,
      patient: { id: record.patient.id, name: record.patient.name, status: record.patient.status },
      encounter: {
        id: record.clinicalEncounterId,
        status: record.clinicalEncounter.status,
        occurredAt: record.clinicalEncounter.occurredAt.toISOString(),
        reason: record.clinicalEncounter.reason,
      },
      responsiblePractitioner: this.toActor(record.responsiblePractitionerMembership),
    };
  }

  private toDetail(record: OrderRecord): DiagnosticOrderDetail {
    return {
      ...this.toSummary(record),
      reason: record.reason,
      instructions: record.instructions,
      notes: record.notes,
      requestedBy: this.toActor(record.requestedByMembership),
      resultText: record.resultText,
      interpretation: record.interpretation,
      resultedByMembershipId: record.resultedByMembershipId,
      resultedBy: this.toActor(record.resultedByMembership),
      voidedByMembershipId: record.voidedByMembershipId,
      voidReason: record.voidReason,
      voidedByDisplayName: record.voidedByMembership?.professionalProfile?.displayName ?? null,
    };
  }

  private toActor(
    membership: {
      id: string;
      professionalProfile: { displayName: string; licenseNumber: string | null } | null;
    } | null,
  ) {
    return membership
      ? {
          membershipId: membership.id,
          displayName: membership.professionalProfile?.displayName ?? null,
          licenseNumber: membership.professionalProfile?.licenseNumber ?? null,
        }
      : null;
  }

  private normalizeText(value: string | null | undefined): string | null | undefined {
    if (value === undefined || value === null) return value;
    const normalized = value.trim();
    return normalized || null;
  }

  private pagination(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  private stale(): ConflictException {
    return this.conflict('DIAGNOSTIC_ORDER_STALE', 'Diagnostic order version is stale');
  }

  private immutable(): ConflictException {
    return this.conflict(
      'DIAGNOSTIC_ORDER_IMMUTABLE',
      'Only Draft diagnostic orders can be edited',
    );
  }

  private invalidState(): ConflictException {
    return this.conflict(
      'INVALID_DIAGNOSTIC_ORDER_STATE',
      'Operation is not allowed for this diagnostic order status',
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
