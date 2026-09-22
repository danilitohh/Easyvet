import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClinicalAuditAction,
  ClinicalAuditEntityType,
  ClinicalDocumentOrigin,
  ClinicalDocumentSourceType,
  ClinicalDocumentType,
  ClinicalEncounterStatus,
  ConsentSignatureMethod,
  ConsentSignatureRequestStatus,
  ConsentStatus,
  MembershipStatus,
  Prisma,
} from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { UploadedFile } from '../http/uploaded-file';
import type { Permission } from '@veterinary-saas/contracts';
import type { Environment } from '../config/env';
import type { TenantContext } from '../authorization/authorization.types';
import { hasPermissions } from '../authorization/permissions';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PASSWORD_HASH_OPTIONS } from '../auth/password.service';
import { createStorageKey, STORAGE_SERVICE, type StorageService } from '../storage/storage.service';
import { renderClinicalPdf } from '../documents/pdf-renderer';
import { CreateConsentDto, UpdateConsentDraftDto } from '../documents/documents.dto';

const SAFE_PUBLIC_ERROR = {
  code: 'SIGNATURE_UNAVAILABLE',
  message: 'No fue posible continuar con esta solicitud de firma.',
};

type SignatureIssueResponse = {
  consent: ConsentDetail;
  signingPath: string;
  verificationCode: string;
  expiresAt: Date;
};

export type ConsentDetail = {
  id: string;
  organizationId: string;
  patientId: string;
  clinicalEncounterId: string;
  clinicalProcedureId: string | null;
  status: ConsentStatus;
  version: number;
  title: string;
  purposeText: string | null;
  risksText: string | null;
  benefitsText: string | null;
  alternativesText: string | null;
  estimatedCostText: string | null;
  declarationText: string | null;
  responsiblePractitionerMembershipId: string | null;
  patientNameSnapshot: string | null;
  ownerDisplayNameSnapshot: string | null;
  ownerDocumentTypeSnapshot: string | null;
  ownerDocumentNumberSnapshot: string | null;
  professionalDisplayNameSnapshot: string | null;
  professionalLicenseSnapshot: string | null;
  contentSha256: string | null;
  issuedAt: Date | null;
  signedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  encounterStatus: ClinicalEncounterStatus;
  procedureStatus: string | null;
  patientStatus: string;
  signerName: string | null;
  signatureMethod: ConsentSignatureMethod | null;
  signedDocumentId: string | null;
};

export type PublicConsent = {
  organizationDisplayName: string;
  patientName: string;
  ownerDisplayName: string;
  ownerDocumentMasked: string | null;
  title: string;
  purposeText: string | null;
  risksText: string | null;
  benefitsText: string | null;
  alternativesText: string | null;
  estimatedCostText: string | null;
  declarationText: string;
  professionalDisplayName: string;
  professionalLicense: string | null;
  expiresAt: Date;
};

// ConsentService owns content immutability, one-time signature secrets, parent-state checks, and evidence.
@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async listByPatient(tenant: TenantContext, patientId: string): Promise<ConsentDetail[]> {
    this.requirePermission(tenant, 'consents.read');
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!patient) throw notFound('PATIENT_NOT_FOUND', 'Patient not found');
    const rows = await this.prisma.consent.findMany({
      where: { organizationId: tenant.organizationId, patientId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        patient: { select: { status: true } },
        clinicalEncounter: { select: { status: true } },
        clinicalProcedure: { select: { status: true } },
        signatureRequests: {
          where: { status: ConsentSignatureRequestStatus.SIGNED },
          orderBy: { signedAt: 'desc' },
          take: 1,
        },
      },
    });
    return Promise.all(rows.map((row) => this.toDetail(row, tenant.organizationId)));
  }

  async findOne(tenant: TenantContext, consentId: string): Promise<ConsentDetail> {
    this.requirePermission(tenant, 'consents.read');
    const row = await this.prisma.consent.findFirst({
      where: { id: consentId, organizationId: tenant.organizationId },
      include: {
        patient: { select: { status: true } },
        clinicalEncounter: { select: { status: true } },
        clinicalProcedure: { select: { status: true } },
        signatureRequests: {
          where: { status: ConsentSignatureRequestStatus.SIGNED },
          orderBy: { signedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!row) throw notFound('CONSENT_NOT_FOUND', 'Consent not found');
    return this.toDetail(row, tenant.organizationId);
  }

  async createDraft(
    tenant: TenantContext,
    patientId: string,
    encounterId: string,
    input: CreateConsentDto,
  ): Promise<ConsentDetail> {
    this.requirePermission(tenant, 'consents.create');
    const created = await this.prisma.$transaction(async (tx) => {
      await this.lockAndGetEncounter(tx, tenant.organizationId, patientId, encounterId, true);
      await this.lockAndGetPatient(tx, tenant.organizationId, patientId, true);
      if (input.responsiblePractitionerMembershipId) {
        await this.validatePractitioner(
          tx,
          tenant.organizationId,
          input.responsiblePractitionerMembershipId,
          false,
        );
      }
      if (input.clinicalProcedureId) {
        this.requirePermission(tenant, 'procedures.read');
        await this.validateLinkedProcedure(
          tx,
          tenant.organizationId,
          patientId,
          encounterId,
          input.clinicalProcedureId,
          false,
        );
      }
      const consent = await tx.consent.create({
        data: {
          organizationId: tenant.organizationId,
          patientId,
          clinicalEncounterId: encounterId,
          clinicalProcedureId: input.clinicalProcedureId ?? null,
          title: trimmed(input.title) ?? '',
          purposeText: trimmed(input.purposeText),
          risksText: trimmed(input.risksText),
          benefitsText: trimmed(input.benefitsText),
          alternativesText: trimmed(input.alternativesText),
          estimatedCostText: trimmed(input.estimatedCostText),
          declarationText: trimmed(input.declarationText),
          responsiblePractitionerMembershipId: input.responsiblePractitionerMembershipId ?? null,
          createdByMembershipId: tenant.membershipId,
        },
      });
      await this.audit(tx, tenant, consent.id, ClinicalAuditAction.CONSENT_CREATED, { version: 1 });
      return consent;
    });
    return this.findOne(tenant, created.id);
  }

  async updateDraft(
    tenant: TenantContext,
    consentId: string,
    input: UpdateConsentDraftDto,
  ): Promise<ConsentDetail> {
    this.requirePermission(tenant, 'consents.updateDraft');
    await this.prisma.$transaction(async (tx) => {
      await lockConsent(tx, consentId, tenant.organizationId);
      const current = await tx.consent.findFirst({
        where: { id: consentId, organizationId: tenant.organizationId },
      });
      if (!current) throw notFound('CONSENT_NOT_FOUND', 'Consent not found');
      this.assertVersionAndDraft(current.status, current.version, input.expectedVersion);
      await this.lockAndGetEncounter(
        tx,
        tenant.organizationId,
        current.patientId,
        current.clinicalEncounterId,
        true,
      );
      await this.lockAndGetPatient(tx, tenant.organizationId, current.patientId, true);
      if (input.responsiblePractitionerMembershipId) {
        await this.validatePractitioner(
          tx,
          tenant.organizationId,
          input.responsiblePractitionerMembershipId,
          false,
        );
      }
      if (input.clinicalProcedureId) {
        this.requirePermission(tenant, 'procedures.read');
        await this.validateLinkedProcedure(
          tx,
          tenant.organizationId,
          current.patientId,
          current.clinicalEncounterId,
          input.clinicalProcedureId,
          false,
        );
      }
      const data: Prisma.ConsentUpdateManyMutationInput = { version: { increment: 1 } };
      for (const field of [
        'title',
        'purposeText',
        'risksText',
        'benefitsText',
        'alternativesText',
        'estimatedCostText',
        'declarationText',
      ] as const) {
        if (input[field] !== undefined)
          Object.assign(data, {
            [field]: field === 'title' ? input[field]!.trim() : trimmed(input[field]),
          });
      }
      if (input.responsiblePractitionerMembershipId !== undefined) {
        Object.assign(data, {
          responsiblePractitionerMembershipId: input.responsiblePractitionerMembershipId ?? null,
        });
      }
      if (input.clinicalProcedureId !== undefined)
        Object.assign(data, { clinicalProcedureId: input.clinicalProcedureId ?? null });
      const updated = await tx.consent.updateMany({
        where: {
          id: consentId,
          organizationId: tenant.organizationId,
          status: ConsentStatus.DRAFT,
          version: input.expectedVersion,
        },
        data,
      });
      if (updated.count !== 1)
        throw conflict('VERSION_CONFLICT', 'Consent draft changed; reload before saving');
      await this.audit(tx, tenant, consentId, ClinicalAuditAction.CONSENT_UPDATED, {
        version: input.expectedVersion + 1,
      });
    });
    return this.findOne(tenant, consentId);
  }

  async issue(
    tenant: TenantContext,
    consentId: string,
    expectedVersion: number,
  ): Promise<SignatureIssueResponse> {
    this.requirePermission(tenant, 'consents.issue');
    const token = randomBytes(32).toString('base64url');
    const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = hash(token);
    const otpHash = await argon2.hash(verificationCode, PASSWORD_HASH_OPTIONS);
    const expiresAt = this.expiry();
    await this.prisma.$transaction(async (tx) => {
      await lockConsent(tx, consentId, tenant.organizationId);
      const current = await tx.consent.findFirst({
        where: { id: consentId, organizationId: tenant.organizationId },
      });
      if (!current) throw notFound('CONSENT_NOT_FOUND', 'Consent not found');
      this.assertVersionAndDraft(current.status, current.version, expectedVersion);
      if (!current.title.trim() || !current.declarationText?.trim()) {
        throw new BadRequestException({
          code: 'CONSENT_INCOMPLETE',
          message: 'El título y la declaración son obligatorios para emitir.',
        });
      }
      if (
        !current.responsiblePractitionerMembershipId ||
        current.responsiblePractitionerMembershipId !== tenant.membershipId
      ) {
        throw new ForbiddenException({
          code: 'ISSUE_AUTHOR_MISMATCH',
          message: 'Only the responsible practitioner may issue this consent',
        });
      }
      const encounter = await this.lockAndGetEncounter(
        tx,
        tenant.organizationId,
        current.patientId,
        current.clinicalEncounterId,
        true,
      );
      await this.lockAndGetPatient(tx, tenant.organizationId, current.patientId, true);
      const owner = await tx.owner.findFirst({
        where: { id: encounter.ownerIdAtTime, organizationId: tenant.organizationId },
      });
      const patient = await tx.patient.findFirst({
        where: { id: current.patientId, organizationId: tenant.organizationId },
      });
      if (!owner || !patient)
        throw notFound('CONSENT_CONTEXT_NOT_FOUND', 'Consent context not found');
      if (current.clinicalProcedureId) {
        this.requirePermission(tenant, 'procedures.read');
        await this.validateLinkedProcedure(
          tx,
          tenant.organizationId,
          current.patientId,
          current.clinicalEncounterId,
          current.clinicalProcedureId,
          true,
        );
      }
      const profile = await this.validatePractitioner(
        tx,
        tenant.organizationId,
        current.responsiblePractitionerMembershipId,
        true,
      );
      if (!profile)
        throw new BadRequestException({
          code: 'PROFESSIONAL_PROFILE_REQUIRED',
          message: 'El profesional responsable necesita un perfil profesional.',
        });
      if (!profile.displayName.trim())
        throw new BadRequestException({
          code: 'PROFESSIONAL_PROFILE_REQUIRED',
          message: 'El profesional responsable necesita un nombre profesional.',
        });

      const nextVersion = current.version + 1;
      const snapshots = {
        patientNameSnapshot: patient.name,
        ownerDisplayNameSnapshot: `${owner.firstName} ${owner.lastName ?? ''}`.trim(),
        ownerDocumentTypeSnapshot: owner.documentType,
        ownerDocumentNumberSnapshot: owner.documentNumber,
        professionalDisplayNameSnapshot: profile.displayName,
        professionalLicenseSnapshot: profile.licenseNumber,
      };
      const contentSha256 = issueContentHash({
        consentId,
        version: nextVersion,
        title: current.title.trim(),
        purposeText: current.purposeText,
        risksText: current.risksText,
        benefitsText: current.benefitsText,
        alternativesText: current.alternativesText,
        estimatedCostText: current.estimatedCostText,
        declarationText: current.declarationText,
        ...snapshots,
      });
      const now = new Date();
      const changed = await tx.consent.updateMany({
        where: {
          id: consentId,
          organizationId: tenant.organizationId,
          status: ConsentStatus.DRAFT,
          version: expectedVersion,
        },
        data: {
          ...snapshots,
          contentSha256,
          issuedAt: now,
          issuedByMembershipId: tenant.membershipId,
          status: ConsentStatus.ISSUED,
          version: nextVersion,
        },
      });
      if (changed.count !== 1)
        throw conflict('VERSION_CONFLICT', 'Consent draft changed; reload before issuing');
      await tx.consentSignatureRequest.create({
        data: {
          organizationId: tenant.organizationId,
          consentId,
          status: ConsentSignatureRequestStatus.PENDING,
          tokenHash,
          otpHash,
          expiresAt,
          maxAttempts: this.config.get('SIGNATURE_REQUEST_MAX_ATTEMPTS', { infer: true }),
          createdByMembershipId: tenant.membershipId,
        },
      });
      await this.audit(tx, tenant, consentId, ClinicalAuditAction.CONSENT_ISSUED, {
        version: nextVersion,
      });
    });
    return {
      consent: await this.findOne(tenant, consentId),
      signingPath: `/firmar/${token}`,
      verificationCode,
      expiresAt,
    };
  }

  async reissue(
    tenant: TenantContext,
    consentId: string,
    expectedVersion: number,
  ): Promise<SignatureIssueResponse> {
    this.requirePermission(tenant, 'consents.issue');
    const token = randomBytes(32).toString('base64url');
    const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = hash(token);
    const otpHash = await argon2.hash(verificationCode, PASSWORD_HASH_OPTIONS);
    const expiresAt = this.expiry();
    await this.prisma.$transaction(async (tx) => {
      await lockConsent(tx, consentId, tenant.organizationId);
      const current = await tx.consent.findFirst({
        where: { id: consentId, organizationId: tenant.organizationId },
      });
      if (!current) throw notFound('CONSENT_NOT_FOUND', 'Consent not found');
      if (current.status !== ConsentStatus.ISSUED)
        throw conflict(
          'CONSENT_NOT_ISSUED',
          'Only issued consents can receive a new signature request',
        );
      if (current.version !== expectedVersion)
        throw conflict('VERSION_CONFLICT', 'Consent changed; reload before reissuing');
      await this.lockAndGetEncounter(
        tx,
        tenant.organizationId,
        current.patientId,
        current.clinicalEncounterId,
        true,
      );
      await this.lockAndGetPatient(tx, tenant.organizationId, current.patientId, true);
      if (current.clinicalProcedureId) {
        this.requirePermission(tenant, 'procedures.read');
        await this.validateLinkedProcedure(
          tx,
          tenant.organizationId,
          current.patientId,
          current.clinicalEncounterId,
          current.clinicalProcedureId,
          true,
        );
      }
      const nextVersion = current.version + 1;
      await tx.consentSignatureRequest.updateMany({
        where: {
          organizationId: tenant.organizationId,
          consentId,
          status: ConsentSignatureRequestStatus.PENDING,
        },
        data: {
          status: ConsentSignatureRequestStatus.REVOKED,
          revokedAt: new Date(),
          revokedByMembershipId: tenant.membershipId,
        },
      });
      const changed = await tx.consent.updateMany({
        where: {
          id: consentId,
          organizationId: tenant.organizationId,
          status: ConsentStatus.ISSUED,
          version: expectedVersion,
        },
        data: { version: nextVersion },
      });
      if (changed.count !== 1)
        throw conflict('VERSION_CONFLICT', 'Consent changed; reload before reissuing');
      await tx.consentSignatureRequest.create({
        data: {
          organizationId: tenant.organizationId,
          consentId,
          tokenHash,
          otpHash,
          expiresAt,
          maxAttempts: this.config.get('SIGNATURE_REQUEST_MAX_ATTEMPTS', { infer: true }),
          createdByMembershipId: tenant.membershipId,
        },
      });
      await this.audit(tx, tenant, consentId, ClinicalAuditAction.SIGNATURE_REQUEST_REISSUED, {
        version: nextVersion,
      });
    });
    return {
      consent: await this.findOne(tenant, consentId),
      signingPath: `/firmar/${token}`,
      verificationCode,
      expiresAt,
    };
  }

  async void(
    tenant: TenantContext,
    consentId: string,
    expectedVersion: number,
    reason: string,
  ): Promise<ConsentDetail> {
    this.requirePermission(tenant, 'consents.void');
    await this.prisma.$transaction(async (tx) => {
      await lockConsent(tx, consentId, tenant.organizationId);
      const current = await tx.consent.findFirst({
        where: { id: consentId, organizationId: tenant.organizationId },
      });
      if (!current) throw notFound('CONSENT_NOT_FOUND', 'Consent not found');
      if (current.status !== ConsentStatus.ISSUED && current.status !== ConsentStatus.SIGNED) {
        throw conflict('CONSENT_NOT_VOIDABLE', 'Only issued or signed consents can be voided');
      }
      if (current.version !== expectedVersion)
        throw conflict('VERSION_CONFLICT', 'Consent changed; reload before voiding');
      const now = new Date();
      const updated = await tx.consent.updateMany({
        where: {
          id: consentId,
          organizationId: tenant.organizationId,
          status: current.status,
          version: expectedVersion,
        },
        data: {
          status: ConsentStatus.VOIDED,
          version: { increment: 1 },
          voidedAt: now,
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason.trim(),
        },
      });
      if (updated.count !== 1)
        throw conflict('VERSION_CONFLICT', 'Consent changed; reload before voiding');
      await tx.consentSignatureRequest.updateMany({
        where: {
          organizationId: tenant.organizationId,
          consentId,
          status: ConsentSignatureRequestStatus.PENDING,
        },
        data: {
          status: ConsentSignatureRequestStatus.REVOKED,
          revokedAt: now,
          revokedByMembershipId: tenant.membershipId,
        },
      });
      await this.audit(tx, tenant, consentId, ClinicalAuditAction.CONSENT_VOIDED, {
        version: expectedVersion + 1,
      });
    });
    return this.findOne(tenant, consentId);
  }

  async getPublicConsent(token: string): Promise<PublicConsent> {
    const request = await this.findPublicRequest(token);
    if (!request) throw new NotFoundException(SAFE_PUBLIC_ERROR);
    const consent = request.consent;
    if (await this.publicRequestUnavailable(request))
      throw new NotFoundException(SAFE_PUBLIC_ERROR);
    const ownerDocumentNumber = consent.ownerDocumentNumberSnapshot;
    return {
      organizationDisplayName: consent.organization.name,
      patientName: consent.patientNameSnapshot ?? 'Paciente',
      ownerDisplayName: consent.ownerDisplayNameSnapshot ?? 'Responsable',
      ownerDocumentMasked: ownerDocumentNumber ? maskDocument(ownerDocumentNumber) : null,
      title: consent.title,
      purposeText: consent.purposeText,
      risksText: consent.risksText,
      benefitsText: consent.benefitsText,
      alternativesText: consent.alternativesText,
      estimatedCostText: consent.estimatedCostText,
      declarationText: consent.declarationText ?? '',
      professionalDisplayName: consent.professionalDisplayNameSnapshot ?? 'Profesional responsable',
      professionalLicense: consent.professionalLicenseSnapshot,
      expiresAt: request.expiresAt,
    };
  }

  async signPublic(
    token: string,
    input: {
      verificationCode: string;
      signerName: string;
      signatureMethod: ConsentSignatureMethod;
      accepted: string;
    },
    file: UploadedFile | undefined,
    requestContext: Request,
  ): Promise<{ signedAt: Date; signerName: string; signatureMethod: ConsentSignatureMethod }> {
    if (input.accepted.toLowerCase() !== 'true' || !input.signerName.trim()) {
      throw new BadRequestException(SAFE_PUBLIC_ERROR);
    }
    if (input.signatureMethod === ConsentSignatureMethod.DRAWN) this.assertSignatureImage(file);
    if (input.signatureMethod === ConsentSignatureMethod.TYPED && file)
      throw new BadRequestException(SAFE_PUBLIC_ERROR);

    const tokenHash = hash(token);
    const discovered = await this.prisma.consentSignatureRequest.findUnique({
      where: { tokenHash },
      select: { id: true, consentId: true, organizationId: true },
    });
    if (!discovered) throw new NotFoundException(SAFE_PUBLIC_ERROR);
    const rollbackKeys: string[] = [];

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await lockConsent(tx, discovered.consentId, discovered.organizationId);
        const requestRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM consent_signature_requests
          WHERE id = ${discovered.id}::uuid AND organization_id = ${discovered.organizationId}::uuid
          FOR UPDATE
        `;
        if (!requestRows.length) return { failure: 'unavailable' as const };
        const signatureRequest = await tx.consentSignatureRequest.findFirst({
          where: { id: discovered.id, organizationId: discovered.organizationId, tokenHash },
          include: {
            consent: {
              include: {
                organization: { select: { name: true } },
                clinicalEncounter: { select: { status: true } },
                clinicalProcedure: { select: { status: true } },
                patient: { select: { status: true } },
              },
            },
          },
        });
        if (
          !signatureRequest ||
          signatureRequest.status !== ConsentSignatureRequestStatus.PENDING ||
          signatureRequest.expiresAt <= new Date() ||
          signatureRequest.failedAttempts >= signatureRequest.maxAttempts
        ) {
          return { failure: 'unavailable' as const };
        }
        const consent = signatureRequest.consent;
        if (
          consent.status !== ConsentStatus.ISSUED ||
          (await this.publicRequestUnavailable(signatureRequest))
        ) {
          return { failure: 'unavailable' as const };
        }

        let validOtp = false;
        try {
          validOtp = await argon2.verify(signatureRequest.otpHash, input.verificationCode);
        } catch {
          validOtp = false;
        }
        if (!validOtp) {
          await tx.consentSignatureRequest.updateMany({
            where: {
              id: signatureRequest.id,
              status: ConsentSignatureRequestStatus.PENDING,
              failedAttempts: { lt: signatureRequest.maxAttempts },
            },
            data: { failedAttempts: { increment: 1 } },
          });
          return { failure: 'invalid-otp' as const };
        }

        await this.lockAndGetEncounter(
          tx,
          consent.organizationId,
          consent.patientId,
          consent.clinicalEncounterId,
          true,
        );
        await this.lockAndGetPatient(tx, consent.organizationId, consent.patientId, true);
        if (consent.clinicalProcedureId) {
          await this.validateLinkedProcedure(
            tx,
            consent.organizationId,
            consent.patientId,
            consent.clinicalEncounterId,
            consent.clinicalProcedureId,
            true,
          );
        }

        const signedAt = new Date();
        const signerName = input.signerName.trim();
        const signatureSha256 =
          input.signatureMethod === ConsentSignatureMethod.DRAWN
            ? createHash('sha256').update(file!.buffer).digest('hex')
            : null;
        const evidenceSha256 = signatureEvidenceHash({
          consentHash: consent.contentSha256!,
          requestId: signatureRequest.id,
          signedAt: signedAt.toISOString(),
          signerName,
          signatureMethod: input.signatureMethod,
          signatureSha256,
        });

        let signatureStorageKey: string | null = null;
        if (input.signatureMethod === ConsentSignatureMethod.DRAWN) {
          signatureStorageKey = createStorageKey(consent.organizationId, randomUUID(), 'png');
          rollbackKeys.push(signatureStorageKey);
          await this.storage.put(signatureStorageKey, file!.buffer, 'image/png');
        }
        const documentId = randomUUID();
        const documentKey = createStorageKey(consent.organizationId, documentId, 'pdf');
        rollbackKeys.push(documentKey);
        const pdfBytes = await renderClinicalPdf({
          title: `Consentimiento firmado: ${consent.title}`,
          organizationName: consent.organization.name,
          patientName: consent.patientNameSnapshot,
          ownerName: consent.ownerDisplayNameSnapshot,
          professionalName: consent.professionalDisplayNameSnapshot,
          clinicalDate: signedAt,
          documentId,
          generatedAt: signedAt,
          signatureImage:
            input.signatureMethod === ConsentSignatureMethod.DRAWN ? file!.buffer : undefined,
          evidenceSha256,
          fields: [
            { label: 'Licencia profesional', value: consent.professionalLicenseSnapshot },
            { label: 'Propósito', value: consent.purposeText },
            { label: 'Riesgos', value: consent.risksText },
            { label: 'Beneficios', value: consent.benefitsText },
            { label: 'Alternativas', value: consent.alternativesText },
            { label: 'Costo estimado', value: consent.estimatedCostText },
            { label: 'Declaración', value: consent.declarationText },
            { label: 'Firmante', value: signerName },
            { label: 'Método de aceptación', value: input.signatureMethod },
            { label: 'Firmado', value: signedAt },
          ],
        });
        await this.storage.put(documentKey, pdfBytes, 'application/pdf');

        const nextVersion = consent.version + 1;
        const updatedConsent = await tx.consent.updateMany({
          where: {
            id: consent.id,
            organizationId: consent.organizationId,
            status: ConsentStatus.ISSUED,
            version: consent.version,
          },
          data: { status: ConsentStatus.SIGNED, signedAt, version: nextVersion },
        });
        if (updatedConsent.count !== 1)
          throw conflict('SIGNATURE_RACE_LOST', 'The signing request is no longer active');
        const updatedRequest = await tx.consentSignatureRequest.updateMany({
          where: {
            id: signatureRequest.id,
            status: ConsentSignatureRequestStatus.PENDING,
            failedAttempts: { lt: signatureRequest.maxAttempts },
          },
          data: {
            status: ConsentSignatureRequestStatus.SIGNED,
            signedAt,
            signerName,
            signatureMethod: input.signatureMethod,
            signatureStorageKey,
            signatureSha256,
            evidenceSha256,
            ipAddress: requestContext.ip?.slice(0, 64) ?? null,
            userAgent: requestContext.get('user-agent')?.slice(0, 500) ?? null,
          },
        });
        if (updatedRequest.count !== 1)
          throw conflict('SIGNATURE_RACE_LOST', 'The signing request is no longer active');
        await tx.clinicalDocument.create({
          data: {
            id: documentId,
            organizationId: consent.organizationId,
            patientId: consent.patientId,
            clinicalEncounterId: consent.clinicalEncounterId,
            origin: ClinicalDocumentOrigin.GENERATED,
            status: 'ACTIVE',
            documentType: ClinicalDocumentType.SIGNED_CONSENT,
            title: `Consentimiento firmado: ${consent.title}`,
            sourceType: ClinicalDocumentSourceType.CONSENT,
            sourceId: consent.id,
            sourceVersion: nextVersion,
            mimeType: 'application/pdf',
            storageKey: documentKey,
            sizeBytes: BigInt(pdfBytes.byteLength),
            sha256: createHash('sha256').update(pdfBytes).digest('hex'),
            createdByMembershipId: consent.issuedByMembershipId!,
          },
        });
        await this.audit(
          tx,
          { organizationId: consent.organizationId, membershipId: consent.issuedByMembershipId! },
          consent.id,
          ClinicalAuditAction.CONSENT_SIGNED,
          { version: nextVersion, signatureMethod: input.signatureMethod },
        );
        await tx.clinicalAuditEvent.create({
          data: {
            organizationId: consent.organizationId,
            actorMembershipId: consent.issuedByMembershipId,
            entityType: ClinicalAuditEntityType.CLINICAL_DOCUMENT,
            entityId: documentId,
            action: ClinicalAuditAction.DOCUMENT_GENERATED,
            metadata: {
              documentType: ClinicalDocumentType.SIGNED_CONSENT,
              sourceType: ClinicalDocumentSourceType.CONSENT,
              sourceVersion: nextVersion,
            },
          },
        });
        return { signedAt, signerName, signatureMethod: input.signatureMethod };
      });
      if ('failure' in result) {
        if (result.failure === 'invalid-otp') throw new BadRequestException(SAFE_PUBLIC_ERROR);
        throw new NotFoundException(SAFE_PUBLIC_ERROR);
      }
      return result;
    } catch (error) {
      await Promise.all(
        rollbackKeys.map((key) => this.storage.deleteForRollback(key).catch(() => undefined)),
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw new NotFoundException(SAFE_PUBLIC_ERROR);
      }
      throw new ServiceUnavailableException(SAFE_PUBLIC_ERROR);
    }
  }

  private async toDetail(
    row: Awaited<ReturnType<PrismaService['consent']['findFirstOrThrow']>> & {
      patient?: { status: string };
      clinicalEncounter?: { status: ClinicalEncounterStatus };
      clinicalProcedure?: { status: string } | null;
      signatureRequests?: Array<{
        signerName: string | null;
        signatureMethod: ConsentSignatureMethod | null;
        signedAt: Date | null;
      }>;
    },
    organizationId: string,
  ): Promise<ConsentDetail> {
    const [document, signature] = await Promise.all([
      this.prisma.clinicalDocument.findFirst({
        where: {
          organizationId,
          sourceType: ClinicalDocumentSourceType.CONSENT,
          sourceId: row.id,
          documentType: ClinicalDocumentType.SIGNED_CONSENT,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
      Promise.resolve(row.signatureRequests?.[0] ?? null),
    ]);
    return {
      id: row.id,
      organizationId: row.organizationId,
      patientId: row.patientId,
      clinicalEncounterId: row.clinicalEncounterId,
      clinicalProcedureId: row.clinicalProcedureId,
      status: row.status,
      version: row.version,
      title: row.title,
      purposeText: row.purposeText,
      risksText: row.risksText,
      benefitsText: row.benefitsText,
      alternativesText: row.alternativesText,
      estimatedCostText: row.estimatedCostText,
      declarationText: row.declarationText,
      responsiblePractitionerMembershipId: row.responsiblePractitionerMembershipId,
      patientNameSnapshot: row.patientNameSnapshot,
      ownerDisplayNameSnapshot: row.ownerDisplayNameSnapshot,
      ownerDocumentTypeSnapshot: row.ownerDocumentTypeSnapshot,
      ownerDocumentNumberSnapshot: row.ownerDocumentNumberSnapshot,
      professionalDisplayNameSnapshot: row.professionalDisplayNameSnapshot,
      professionalLicenseSnapshot: row.professionalLicenseSnapshot,
      contentSha256: row.contentSha256,
      issuedAt: row.issuedAt,
      signedAt: row.signedAt,
      voidedAt: row.voidedAt,
      voidReason: row.voidReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      encounterStatus: row.clinicalEncounter?.status ?? ClinicalEncounterStatus.VOIDED,
      procedureStatus: row.clinicalProcedure?.status ?? null,
      patientStatus: row.patient?.status ?? 'ARCHIVED',
      signerName: signature?.signerName ?? null,
      signatureMethod: signature?.signatureMethod ?? null,
      signedDocumentId: document?.id ?? null,
    };
  }

  private async findPublicRequest(token: string) {
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
    return this.prisma.consentSignatureRequest.findUnique({
      where: { tokenHash: hash(token) },
      include: {
        consent: {
          include: {
            organization: { select: { name: true } },
            clinicalEncounter: { select: { status: true } },
            clinicalProcedure: { select: { status: true } },
            patient: { select: { status: true } },
          },
        },
      },
    });
  }

  private async publicRequestUnavailable(request: {
    status: ConsentSignatureRequestStatus;
    expiresAt: Date;
    failedAttempts: number;
    maxAttempts: number;
    consent: {
      status: ConsentStatus;
      clinicalEncounter: { status: ClinicalEncounterStatus };
      clinicalProcedure: { status: string } | null;
      patient: { status: string };
    };
  }): Promise<boolean> {
    return (
      request.status !== ConsentSignatureRequestStatus.PENDING ||
      request.expiresAt <= new Date() ||
      request.failedAttempts >= request.maxAttempts ||
      request.consent.status !== ConsentStatus.ISSUED ||
      request.consent.clinicalEncounter.status === ClinicalEncounterStatus.VOIDED ||
      request.consent.clinicalProcedure?.status === 'VOIDED' ||
      request.consent.patient.status !== 'ACTIVE'
    );
  }

  private async lockAndGetEncounter(
    tx: Prisma.TransactionClient,
    organizationId: string,
    patientId: string,
    encounterId: string,
    allowFinalized: boolean,
  ) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM clinical_encounters WHERE id = ${encounterId}::uuid AND organization_id = ${organizationId}::uuid AND patient_id = ${patientId}::uuid FOR UPDATE
    `;
    if (!locked.length) throw notFound('ENCOUNTER_NOT_FOUND', 'Encounter not found');
    const encounter = await tx.clinicalEncounter.findFirst({
      where: { id: encounterId, organizationId, patientId },
      select: { id: true, ownerIdAtTime: true, status: true },
    });
    if (!encounter) throw notFound('ENCOUNTER_NOT_FOUND', 'Encounter not found');
    const permittedStatuses: ClinicalEncounterStatus[] = allowFinalized
      ? [ClinicalEncounterStatus.DRAFT, ClinicalEncounterStatus.FINALIZED]
      : [ClinicalEncounterStatus.DRAFT];
    if (!permittedStatuses.includes(encounter.status))
      throw conflict('ENCOUNTER_VOIDED', 'A voided encounter cannot be used for consent');
    return encounter;
  }

  private async lockAndGetPatient(
    tx: Prisma.TransactionClient,
    organizationId: string,
    patientId: string,
    activeOnly: boolean,
  ) {
    await lockPatient(tx, patientId, organizationId);
    return this.requireActivePatient(tx, organizationId, patientId, activeOnly);
  }

  private async requireActivePatient(
    tx: Prisma.TransactionClient,
    organizationId: string,
    patientId: string,
    activeOnly = true,
  ) {
    const patient = await tx.patient.findFirst({ where: { id: patientId, organizationId } });
    if (!patient) throw notFound('PATIENT_NOT_FOUND', 'Patient not found');
    if (activeOnly && patient.status !== 'ACTIVE')
      throw conflict('PATIENT_ARCHIVED', 'Archived patients cannot receive new or signed consents');
    return patient;
  }

  private async validatePractitioner(
    tx: Prisma.TransactionClient,
    organizationId: string,
    membershipId: string,
    requireProfile: boolean,
  ) {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: MembershipStatus.ACTIVE,
        clinicalRole: 'PRACTITIONER',
      },
      include: { professionalProfile: true },
    });
    if (!membership)
      throw new BadRequestException({
        code: 'RESPONSIBLE_PRACTITIONER_INVALID',
        message: 'Selecciona un profesional clínico activo.',
      });
    if (requireProfile && !membership.professionalProfile)
      throw new BadRequestException({
        code: 'PROFESSIONAL_PROFILE_REQUIRED',
        message: 'El profesional responsable necesita un perfil profesional.',
      });
    return membership.professionalProfile;
  }

  private async validateLinkedProcedure(
    tx: Prisma.TransactionClient,
    organizationId: string,
    patientId: string,
    encounterId: string,
    procedureId: string,
    requireIssuable: boolean,
  ) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM clinical_procedures WHERE id = ${procedureId}::uuid AND organization_id = ${organizationId}::uuid AND patient_id = ${patientId}::uuid AND clinical_encounter_id = ${encounterId}::uuid FOR UPDATE
    `;
    if (!locked.length) throw notFound('PROCEDURE_NOT_FOUND', 'Procedure not found');
    const procedure = await tx.clinicalProcedure.findFirst({
      where: { id: procedureId, organizationId, patientId, clinicalEncounterId: encounterId },
      select: { status: true },
    });
    if (!procedure) throw notFound('PROCEDURE_NOT_FOUND', 'Procedure not found');
    if (requireIssuable && !['DRAFT', 'FINALIZED'].includes(procedure.status))
      throw conflict('PROCEDURE_VOIDED', 'A voided procedure cannot be issued for consent');
    return procedure;
  }

  private requirePermission(tenant: TenantContext, permission: string): void {
    if (!hasPermissions(tenant.role, tenant.clinicalRole, [permission as Permission])) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Insufficient permission',
      });
    }
  }

  private assertVersionAndDraft(
    status: ConsentStatus,
    version: number,
    expectedVersion: number,
  ): void {
    if (status !== ConsentStatus.DRAFT)
      throw conflict('CONSENT_NOT_DRAFT', 'Only draft consents can be edited or issued');
    if (version !== expectedVersion)
      throw conflict('VERSION_CONFLICT', 'Consent draft changed; reload before saving');
  }

  private assertSignatureImage(file: UploadedFile | undefined): void {
    if (
      !file ||
      file.mimetype !== 'image/png' ||
      file.size < 1 ||
      file.size > 1024 * 1024 ||
      file.buffer.length < 8 ||
      !file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      throw new BadRequestException(SAFE_PUBLIC_ERROR);
    }
  }

  private expiry(): Date {
    const hours = this.config.get('SIGNATURE_REQUEST_TTL_HOURS', { infer: true });
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actor: Pick<TenantContext, 'organizationId' | 'membershipId'>,
    consentId: string,
    action: ClinicalAuditAction,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await tx.clinicalAuditEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorMembershipId: actor.membershipId,
        entityType: ClinicalAuditEntityType.CONSENT,
        entityId: consentId,
        action,
        metadata,
      },
    });
  }
}

// Locks a consent row before state transitions so sign, reissue and void serialize consistently.
async function lockConsent(
  tx: Prisma.TransactionClient,
  consentId: string,
  organizationId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM consents WHERE id = ${consentId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE
  `;
  if (!rows.length) throw notFound('CONSENT_NOT_FOUND', 'Consent not found');
}

// Patient locking makes the archive check linearizable with signing and new consent writes.
async function lockPatient(
  tx: Prisma.TransactionClient,
  patientId: string,
  organizationId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM patients WHERE id = ${patientId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE
  `;
  if (!rows.length) throw notFound('PATIENT_NOT_FOUND', 'Patient not found');
}

// Canonical object property order makes content hashes stable across requests and runtime versions.
function issueContentHash(content: {
  consentId: string;
  version: number;
  title: string;
  purposeText: string | null;
  risksText: string | null;
  benefitsText: string | null;
  alternativesText: string | null;
  estimatedCostText: string | null;
  declarationText: string | null;
  patientNameSnapshot: string;
  ownerDisplayNameSnapshot: string;
  ownerDocumentTypeSnapshot: string | null;
  ownerDocumentNumberSnapshot: string | null;
  professionalDisplayNameSnapshot: string;
  professionalLicenseSnapshot: string | null;
}): string {
  const canonical = JSON.stringify({ schema: 1, ...content });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// Signature evidence commits to issued content and signer data without exposing raw IP, UA or tokens.
function signatureEvidenceHash(input: {
  consentHash: string;
  requestId: string;
  signedAt: string;
  signerName: string;
  signatureMethod: ConsentSignatureMethod;
  signatureSha256: string | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.consentHash,
        input.requestId,
        input.signedAt,
        input.signerName,
        input.signatureMethod,
        input.signatureSha256,
      ]),
      'utf8',
    )
    .digest('hex');
}

// Hashing a URL token preserves one-way lookup while the bearer secret exists only in the response.
function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

// OTP and token validation failures intentionally share a non-enumerating public message.
function notFound(code: string, message: string): NotFoundException {
  return new NotFoundException({ code, message });
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function trimmed(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return value.trim() || null;
}

function maskDocument(value: string): string {
  const normalized = value.replace(/\s/g, '');
  const visible = normalized.slice(-4);
  return `${'•'.repeat(Math.max(4, normalized.length - visible.length))}${visible}`;
}
