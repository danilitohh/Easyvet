import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalEncounterStatus,
  ClinicalRole,
  MembershipStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';

export type DomainDatabase = PrismaService | Prisma.TransactionClient;
export type PreventiveAuditEntity = 'VACCINATION' | 'DEWORMING';

export function notFound(code: string, message: string): NotFoundException {
  return new NotFoundException({ code, message });
}

export function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

export function validation(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

export function forbidden(code: string, message: string): ForbiddenException {
  return new ForbiddenException({ code, message });
}

// Civil dates are parsed as UTC only for PostgreSQL DATE transport; no timezone conversion is applied.
export function parseCivilDate(
  value: string | null | undefined,
  field: string,
): Date | null | undefined {
  if (value === undefined || value === null) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validation('VALIDATION_ERROR', `${field} must use YYYY-MM-DD`);
  }
  const parts = value.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw validation('VALIDATION_ERROR', `${field} is not a valid civil date`);
  }
  return parsed;
}

export function formatCivilDate(value: Date | null): string | null {
  if (!value) return null;
  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = value.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function trimmedNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function trimmedRequired(
  value: string | null | undefined,
  code: string,
  field: string,
): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) throw conflict(code, `${field} is required`);
  return trimmed;
}

export function ensureDateOrder(
  administeredOn: string | null | undefined,
  nextDueOn: string | null | undefined,
): void {
  if (administeredOn && nextDueOn && nextDueOn < administeredOn) {
    throw conflict('INVALID_NEXT_DUE_DATE', 'nextDueOn must be on or after administeredOn');
  }
}

export async function lockEncounter(
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

export async function lockPatient(
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

export async function lockOwner(
  database: DomainDatabase,
  organizationId: string,
  ownerId: string,
): Promise<void> {
  await database.$queryRaw(Prisma.sql`
    SELECT "id" FROM "owners"
    WHERE "id" = ${ownerId}::uuid AND "organization_id" = ${organizationId}::uuid
    FOR UPDATE
  `);
}

export async function lockMembership(
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

export async function requireEncounter(
  database: DomainDatabase,
  organizationId: string,
  encounterId: string,
) {
  const encounter = await database.clinicalEncounter.findFirst({
    where: { id: encounterId, organizationId },
    select: { id: true, organizationId: true, patientId: true, ownerIdAtTime: true, status: true },
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

export async function requireAnyPatient(
  database: DomainDatabase,
  organizationId: string,
  patientId: string,
) {
  const patient = await database.patient.findFirst({
    where: { id: patientId, organizationId },
    select: { id: true, name: true, ownerId: true, status: true },
  });
  if (!patient) throw notFound('RESOURCE_NOT_FOUND', 'Patient not found');
  return patient;
}

export async function requireActivePatient(
  database: DomainDatabase,
  organizationId: string,
  patientId: string,
) {
  const patient = await requireAnyPatient(database, organizationId, patientId);
  if (patient.status !== 'ACTIVE') {
    throw conflict('PATIENT_ARCHIVED', 'Archived patients cannot receive new clinical activity');
  }
  return patient;
}

export async function requireResponsibleMembership(
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
    throw conflict('RESPONSIBLE_PRACTITIONER_REQUIRED', 'A responsible practitioner is required');
  }
  return membership;
}

export async function requireAdministeredMembership(
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
      // Only clinical roles may be selected as the person who administered care.
      // Keep this explicit so future non-clinical membership roles cannot leak into
      // the clinical transaction boundary by merely being non-null.
      clinicalRole: { in: [ClinicalRole.PRACTITIONER, ClinicalRole.CLINICAL_ASSISTANT] },
    },
    select: {
      id: true,
      clinicalRole: true,
      professionalProfile: { select: { displayName: true, licenseNumber: true } },
    },
  });
  if (!membership) {
    throw conflict('ADMINISTERED_BY_INVALID', 'The administered-by membership is not active');
  }
  return membership;
}

export function requirePractitionerActor(tenant: TenantContext): void {
  if (tenant.clinicalRole !== ClinicalRole.PRACTITIONER) {
    throw forbidden('INSUFFICIENT_PERMISSION', 'A practitioner clinical role is required');
  }
}

export function requireChangedFields(input: object, expectedVersion: string): void {
  const changed = Object.keys(input).some((key) => key !== expectedVersion);
  if (!changed) throw validation('VALIDATION_ERROR', 'At least one editable field is required');
}

export async function createPreventiveAudit(
  tx: Prisma.TransactionClient,
  tenant: TenantContext,
  entityType: PreventiveAuditEntity,
  entityId: string,
  action: 'CREATED' | 'UPDATED' | 'FINALIZED' | 'VOIDED',
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

export function pagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
