import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ClinicalDocumentOrigin,
  ClinicalDocumentSourceType,
  ClinicalDocumentStatus,
  ClinicalDocumentType,
  ClinicalAuditAction,
  ClinicalAuditEntityType,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { Permission } from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { hasPermissions } from '../authorization/permissions';
import { PrismaService } from '../infrastructure/database/prisma.service';
import type { UploadedFile } from '../http/uploaded-file';
import { createStorageKey, STORAGE_SERVICE, type StorageService } from '../storage/storage.service';
import { ClinicalPdfInput, PdfField, renderClinicalPdf } from './pdf-renderer';
import { DocumentListQueryDto } from './documents.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SOURCE_TABLE: Record<ClinicalDocumentSourceType, string> = {
  PRESCRIPTION: 'prescriptions',
  VACCINATION: 'vaccinations',
  CLINICAL_PROCEDURE: 'clinical_procedures',
  ANESTHESIA_RECORD: 'anesthesia_records',
  HOSPITALIZATION: 'hospitalizations',
  DIAGNOSTIC_ORDER: 'diagnostic_orders',
  CONSENT: 'consents',
};

type DocumentMetadata = {
  id: string;
  patientId: string;
  clinicalEncounterId: string | null;
  origin: ClinicalDocumentOrigin;
  status: ClinicalDocumentStatus;
  documentType: ClinicalDocumentType;
  title: string;
  originalFileName: string | null;
  sourceType: ClinicalDocumentSourceType | null;
  sourceId: string | null;
  sourceVersion: number | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  voidReason: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  sourceStatus?: string | null;
};

type PdfSource = {
  sourceType: ClinicalDocumentSourceType;
  patientId: string;
  clinicalEncounterId: string;
  sourceVersion: number;
  sourceStatus: string;
  documentType: ClinicalDocumentType;
  title: string;
  patientName?: string | null | undefined;
  ownerName?: string | null | undefined;
  professionalName?: string | null | undefined;
  clinicalDate?: string | Date | null | undefined;
  fields: PdfField[];
  signatureImage?: Buffer | undefined;
  evidenceSha256?: string | undefined;
};

const documentMetadataSelect = {
  id: true,
  patientId: true,
  clinicalEncounterId: true,
  origin: true,
  status: true,
  documentType: true,
  title: true,
  originalFileName: true,
  sourceType: true,
  sourceId: true,
  sourceVersion: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  voidReason: true,
  voidedAt: true,
  createdAt: true,
} satisfies Prisma.ClinicalDocumentSelect;

const documentDownloadSelect = {
  ...documentMetadataSelect,
  storageKey: true,
} satisfies Prisma.ClinicalDocumentSelect;

type DocumentMetadataRecord = Prisma.ClinicalDocumentGetPayload<{
  select: typeof documentMetadataSelect;
}>;

// Documents own immutable files and metadata; source domains remain authoritative for clinical state.
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async listByPatient(
    tenant: TenantContext,
    patientId: string,
    query: DocumentListQueryDto,
  ): Promise<{
    data: DocumentMetadata[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    this.requirePermission(tenant, 'documents.read');
    await this.requirePatient(tenant, patientId, false);
    const where: Prisma.ClinicalDocumentWhereInput = {
      organizationId: tenant.organizationId,
      patientId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.clinicalEncounterId ? { clinicalEncounterId: query.clinicalEncounterId } : {}),
    };
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.clinicalDocument.findMany({
        where,
        select: documentMetadataSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: Math.min(pageSize, 100),
      }),
      this.prisma.clinicalDocument.count({ where }),
    ]);
    const sourceStatusMap = await loadSourceStatuses(
      this.prisma,
      tenant.organizationId,
      rows.flatMap((row) => (row.sourceType && row.sourceId ? [row] : [])),
    );
    return {
      data: rows.map((row) => ({
        ...toMetadata(row),
        sourceStatus:
          row.sourceType && row.sourceId
            ? (sourceStatusMap.get(`${row.sourceType}:${row.sourceId}`) ?? null)
            : null,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async findOne(tenant: TenantContext, documentId: string): Promise<DocumentMetadata> {
    this.requirePermission(tenant, 'documents.read');
    const document = await this.prisma.clinicalDocument.findFirst({
      where: { id: documentId, organizationId: tenant.organizationId },
      select: documentMetadataSelect,
    });
    if (!document)
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    const metadata = toMetadata(document);
    if (document.sourceType && document.sourceId) {
      metadata.sourceStatus = await this.sourceStatus(
        this.prisma,
        document.sourceType,
        document.sourceId,
        tenant.organizationId,
      );
    }
    return metadata;
  }

  async download(
    tenant: TenantContext,
    documentId: string,
  ): Promise<{ metadata: DocumentMetadata; bytes: Buffer }> {
    this.requirePermission(tenant, 'documents.read');
    const document = await this.prisma.clinicalDocument.findFirst({
      where: { id: documentId, organizationId: tenant.organizationId },
      select: documentDownloadSelect,
    });
    if (!document)
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    try {
      const bytes = await this.storage.get(document.storageKey);
      const actualHash = createHash('sha256').update(bytes).digest('hex');
      if (actualHash !== document.sha256 || BigInt(bytes.byteLength) !== document.sizeBytes) {
        throw new Error('Stored artifact integrity check failed');
      }
      return { metadata: toMetadata(document), bytes };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DOCUMENT_STORAGE_UNAVAILABLE',
        message: 'Document is temporarily unavailable',
      });
    }
  }

  async generate(
    tenant: TenantContext,
    documentType: ClinicalDocumentType,
    sourceId: string,
  ): Promise<DocumentMetadata> {
    this.requirePermission(tenant, 'documents.generate');
    const sourceType = sourceTypeForDocumentType(documentType);
    this.assertSourcePermission(tenant, sourceType);
    let storedKey: string | null = null;

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        // Discovery is read-only: lock the parent hierarchy before the source row to share the
        // Encounter → Patient → clinical-record order used by lifecycle mutations.
        let source = await this.loadPdfSource(tx, tenant.organizationId, sourceType, sourceId);
        await lockTenantEncounter(
          tx,
          tenant.organizationId,
          source.patientId,
          source.clinicalEncounterId,
        );
        await lockPatient(tx, source.patientId, tenant.organizationId);
        const patient = await tx.patient.findFirst({
          where: { id: source.patientId, organizationId: tenant.organizationId },
          select: { status: true },
        });
        if (!patient)
          throw new NotFoundException({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
        if (patient.status !== 'ACTIVE')
          throw new ConflictException({
            code: 'PATIENT_ARCHIVED',
            message: 'Archived patients cannot receive new clinical documents',
          });
        await lockTenantSource(tx, sourceType, sourceId, tenant.organizationId);
        source = await this.loadPdfSource(tx, tenant.organizationId, sourceType, sourceId);
        const encounter = await tx.clinicalEncounter.findFirst({
          where: {
            id: source.clinicalEncounterId,
            patientId: source.patientId,
            organizationId: tenant.organizationId,
          },
          select: { status: true },
        });
        if (!encounter)
          throw new NotFoundException({
            code: 'SOURCE_NOT_FOUND',
            message: 'Clinical source not found',
          });
        if (encounter.status === 'VOIDED')
          throw new ConflictException({
            code: 'SOURCE_PARENT_VOIDED',
            message: 'Clinical documents cannot be generated from a voided encounter',
          });
        assertEligibleSource(source);
        const existing = await tx.clinicalDocument.findFirst({
          where: {
            organizationId: tenant.organizationId,
            documentType,
            sourceType,
            sourceId,
            sourceVersion: source.sourceVersion,
          },
          select: documentMetadataSelect,
        });
        if (existing) return existing;

        const id = randomUUID();
        storedKey = createStorageKey(tenant.organizationId, id, 'pdf');
        const organization = await tx.organization.findUnique({
          where: { id: tenant.organizationId },
          select: { name: true },
        });
        const generatedAt = new Date();
        const pdfInput = this.toPdfInput(source, id, organization?.name ?? 'Easyvet', generatedAt);
        const bytes = await renderClinicalPdf(pdfInput);
        await this.storage.put(storedKey, bytes, 'application/pdf');
        const row = await tx.clinicalDocument.create({
          select: documentMetadataSelect,
          data: {
            id,
            organizationId: tenant.organizationId,
            patientId: source.patientId,
            clinicalEncounterId: source.clinicalEncounterId,
            origin: ClinicalDocumentOrigin.GENERATED,
            documentType,
            title: pdfInput.title,
            sourceType,
            sourceId,
            sourceVersion: source.sourceVersion,
            mimeType: 'application/pdf',
            storageKey: storedKey,
            sizeBytes: BigInt(bytes.byteLength),
            sha256: createHash('sha256').update(bytes).digest('hex'),
            createdByMembershipId: tenant.membershipId,
          },
        });
        await tx.clinicalAuditEvent.create({
          data: {
            organizationId: tenant.organizationId,
            actorMembershipId: tenant.membershipId,
            entityType: ClinicalAuditEntityType.CLINICAL_DOCUMENT,
            entityId: id,
            action: ClinicalAuditAction.DOCUMENT_GENERATED,
            metadata: { documentType, sourceType, sourceVersion: source.sourceVersion },
          },
        });
        return row;
      });
      return toMetadata(document);
    } catch (error) {
      if (storedKey) await this.storage.deleteForRollback(storedKey).catch(() => undefined);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      )
        throw error;
      throw error;
    }
  }

  async upload(
    tenant: TenantContext,
    patientId: string,
    input: {
      title: string;
      clinicalEncounterId?: string;
      sourceType?: ClinicalDocumentSourceType;
      sourceId?: string;
    },
    file: UploadedFile,
  ): Promise<DocumentMetadata> {
    this.requirePermission(tenant, 'documents.upload');
    this.assertUpload(file);
    if (Boolean(input.sourceType) !== Boolean(input.sourceId)) {
      throw new BadRequestException({
        code: 'SOURCE_REFERENCE_INCOMPLETE',
        message: 'Both source type and source identifier are required',
      });
    }
    if (input.sourceType) this.assertSourcePermission(tenant, input.sourceType);

    const id = randomUUID();
    const extension =
      file.mimetype === 'application/pdf' ? 'pdf' : file.mimetype === 'image/png' ? 'png' : 'jpg';
    const storageKey = createStorageKey(tenant.organizationId, id, extension);
    const originalFileName = sanitizeOriginalFilename(file.originalname);
    let stored = false;
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (input.sourceType === ClinicalDocumentSourceType.CONSENT) {
          throw new BadRequestException({
            code: 'CONSENT_FILE_LINK_UNSUPPORTED',
            message: 'Signed consent documents are created by the consent signing workflow',
          });
        }
        const linkedSource =
          input.sourceType && input.sourceId
            ? await linkedSourceContext(tx, input.sourceType, input.sourceId, tenant.organizationId)
            : null;
        if (input.sourceType && input.sourceId && !linkedSource) {
          throw new NotFoundException({
            code: 'SOURCE_NOT_FOUND',
            message: 'Clinical source not found',
          });
        }
        if (
          linkedSource &&
          (linkedSource.patientId !== patientId ||
            (input.clinicalEncounterId &&
              input.clinicalEncounterId !== linkedSource.clinicalEncounterId))
        ) {
          throw new NotFoundException({
            code: 'SOURCE_NOT_FOUND',
            message: 'Clinical source not found',
          });
        }
        const encounterId = input.clinicalEncounterId ?? linkedSource?.clinicalEncounterId ?? null;
        if (encounterId) {
          await lockTenantEncounter(tx, tenant.organizationId, patientId, encounterId);
          const encounter = await tx.clinicalEncounter.findFirst({
            where: { id: encounterId, organizationId: tenant.organizationId, patientId },
            select: { status: true },
          });
          if (!encounter)
            throw new NotFoundException({
              code: 'ENCOUNTER_NOT_FOUND',
              message: 'Encounter not found',
            });
          if (encounter.status === 'VOIDED')
            throw new ConflictException({
              code: 'ENCOUNTER_VOIDED',
              message: 'Voided encounters cannot receive new documents',
            });
        }
        await lockPatient(tx, patientId, tenant.organizationId);
        const patient = await tx.patient.findFirst({
          where: { id: patientId, organizationId: tenant.organizationId },
          select: { status: true },
        });
        if (!patient)
          throw new NotFoundException({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
        if (patient.status !== 'ACTIVE')
          throw new ConflictException({
            code: 'PATIENT_ARCHIVED',
            message: 'Archived patients cannot receive new clinical documents',
          });

        if (input.sourceType && input.sourceId) {
          await lockTenantSource(tx, input.sourceType, input.sourceId, tenant.organizationId);
          const currentSource = await linkedSourceContext(
            tx,
            input.sourceType,
            input.sourceId,
            tenant.organizationId,
          );
          if (
            !currentSource ||
            currentSource.patientId !== patientId ||
            currentSource.clinicalEncounterId !== encounterId
          )
            throw new NotFoundException({
              code: 'SOURCE_NOT_FOUND',
              message: 'Clinical source not found',
            });
          if (currentSource.status === 'VOIDED')
            throw new ConflictException({
              code: 'SOURCE_VOIDED',
              message: 'Voided clinical sources cannot receive new documents',
            });
        }

        stored = true;
        await this.storage.put(storageKey, file.buffer, file.mimetype);
        const created = await tx.clinicalDocument.create({
          select: documentMetadataSelect,
          data: {
            id,
            organizationId: tenant.organizationId,
            patientId,
            clinicalEncounterId: encounterId,
            origin: ClinicalDocumentOrigin.UPLOADED,
            documentType: ClinicalDocumentType.CLINICAL_ATTACHMENT,
            title: input.title.trim(),
            originalFileName,
            sourceType: input.sourceType ?? null,
            sourceId: input.sourceId ?? null,
            mimeType: file.mimetype,
            storageKey,
            sizeBytes: BigInt(file.size),
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
            createdByMembershipId: tenant.membershipId,
          },
        });
        await tx.clinicalAuditEvent.create({
          data: {
            organizationId: tenant.organizationId,
            actorMembershipId: tenant.membershipId,
            entityType: ClinicalAuditEntityType.CLINICAL_DOCUMENT,
            entityId: id,
            action: ClinicalAuditAction.DOCUMENT_UPLOADED,
            metadata: {
              mimeType: file.mimetype,
              sizeBytes: file.size,
              sourceType: input.sourceType ?? null,
            },
          },
        });
        return created;
      });
      return toMetadata(row);
    } catch (error) {
      if (stored) await this.storage.deleteForRollback(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async void(tenant: TenantContext, documentId: string, reason: string): Promise<DocumentMetadata> {
    this.requirePermission(tenant, 'documents.void');
    const document = await this.prisma.$transaction(async (tx) => {
      const result = await tx.clinicalDocument.updateMany({
        where: {
          id: documentId,
          organizationId: tenant.organizationId,
          status: ClinicalDocumentStatus.ACTIVE,
        },
        data: {
          status: ClinicalDocumentStatus.VOIDED,
          voidedAt: new Date(),
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason.trim(),
        },
      });
      if (result.count !== 1) {
        const exists = await tx.clinicalDocument.findFirst({
          where: { id: documentId, organizationId: tenant.organizationId },
          select: { id: true },
        });
        if (!exists)
          throw new NotFoundException({
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found',
          });
        throw new ConflictException({
          code: 'DOCUMENT_NOT_ACTIVE',
          message: 'Only active documents can be voided',
        });
      }
      const updated = await tx.clinicalDocument.findFirstOrThrow({
        where: { id: documentId, organizationId: tenant.organizationId },
        select: documentMetadataSelect,
      });
      await tx.clinicalAuditEvent.create({
        data: {
          organizationId: tenant.organizationId,
          actorMembershipId: tenant.membershipId,
          entityType: ClinicalAuditEntityType.CLINICAL_DOCUMENT,
          entityId: documentId,
          action: ClinicalAuditAction.DOCUMENT_VOIDED,
          metadata: { status: ClinicalDocumentStatus.VOIDED },
        },
      });
      return updated;
    });
    return toMetadata(document);
  }

  private async requirePatient(tenant: TenantContext, patientId: string, requireActive: boolean) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: tenant.organizationId },
      select: { id: true, status: true },
    });
    if (!patient)
      throw new NotFoundException({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    if (requireActive && patient.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'PATIENT_ARCHIVED',
        message: 'Archived patients cannot receive new clinical documents',
      });
    }
    return patient;
  }

  private assertSourcePermission(
    tenant: TenantContext,
    sourceType: ClinicalDocumentSourceType,
  ): void {
    const sourcePermission: Record<ClinicalDocumentSourceType, string> = {
      PRESCRIPTION: 'prescriptions.read',
      VACCINATION: 'vaccinations.read',
      CLINICAL_PROCEDURE: 'procedures.read',
      ANESTHESIA_RECORD: 'anesthesia.read',
      HOSPITALIZATION: 'hospitalizations.read',
      DIAGNOSTIC_ORDER: 'diagnostics.read',
      CONSENT: 'consents.read',
    };
    if (
      !hasPermissions(tenant.role, tenant.clinicalRole, [
        sourcePermission[sourceType] as Permission,
      ])
    ) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Insufficient permission to read the clinical source',
      });
    }
  }

  private requirePermission(tenant: TenantContext, permission: string): void {
    if (!hasPermissions(tenant.role, tenant.clinicalRole, [permission as Permission])) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Insufficient permission',
      });
    }
  }

  private async loadPdfSource(
    tx: Prisma.TransactionClient,
    organizationId: string,
    sourceType: ClinicalDocumentSourceType,
    sourceId: string,
  ): Promise<PdfSource> {
    switch (sourceType) {
      case ClinicalDocumentSourceType.PRESCRIPTION: {
        const row = await tx.prescription.findFirst({
          where: { id: sourceId, organizationId },
          include: { items: { orderBy: { position: 'asc' } } },
        });
        if (!row) throw sourceNotFound();
        return {
          sourceType,
          patientId: row.patientId,
          clinicalEncounterId: row.clinicalEncounterId,
          sourceVersion: row.version,
          sourceStatus: row.status,
          documentType: ClinicalDocumentType.PRESCRIPTION,
          title: 'Fórmula médica',
          patientName: row.patientNameSnapshot,
          ownerName: row.ownerDisplayNameSnapshot,
          professionalName: row.professionalDisplayNameSnapshot,
          clinicalDate: row.finalizedAt,
          fields: [
            { label: 'Licencia profesional', value: row.professionalLicenseSnapshot },
            { label: 'Diagnóstico', value: row.diagnosisSnapshot },
            { label: 'Fecha de finalización', value: row.finalizedAt },
            ...row.items.flatMap((item) => [
              { label: `Medicamento ${item.position + 1}`, value: item.medicationName },
              { label: 'Presentación', value: item.presentation },
              { label: 'Cantidad', value: item.quantity },
              { label: 'Dosis', value: item.dosage },
              { label: 'Frecuencia', value: item.frequency },
              { label: 'Duración', value: item.duration },
              { label: 'Observaciones', value: item.observations },
            ]),
          ],
        };
      }
      case ClinicalDocumentSourceType.VACCINATION: {
        const row = await tx.vaccination.findFirst({ where: { id: sourceId, organizationId } });
        if (!row) throw sourceNotFound();
        return {
          sourceType,
          patientId: row.patientId,
          clinicalEncounterId: row.clinicalEncounterId,
          sourceVersion: row.version,
          sourceStatus: row.status,
          documentType: ClinicalDocumentType.VACCINATION_CERTIFICATE,
          title: 'Certificado de vacunación',
          patientName: row.patientNameSnapshot,
          ownerName: row.ownerDisplayNameSnapshot,
          professionalName: row.professionalDisplayNameSnapshot,
          clinicalDate: row.administeredOn,
          fields: [
            { label: 'Licencia profesional', value: row.professionalLicenseSnapshot },
            { label: 'Aplicado por', value: row.administeredByDisplayNameSnapshot },
            { label: 'Fecha de aplicación', value: row.administeredOn },
            { label: 'Vacuna', value: row.vaccineName },
            { label: 'Tipo', value: row.vaccineType },
            { label: 'Vía', value: row.route },
            { label: 'Laboratorio', value: row.laboratoryName },
            { label: 'Lote', value: row.lotNumber },
            { label: 'Vencimiento del lote', value: row.expiryOn },
            { label: 'Dosis', value: row.doseText },
            { label: 'Próxima dosis', value: row.nextDueOn },
            { label: 'Notas', value: row.notes },
          ],
        };
      }
      case ClinicalDocumentSourceType.CLINICAL_PROCEDURE: {
        const row = await tx.clinicalProcedure.findFirst({
          where: { id: sourceId, organizationId },
          include: { surgeryDetail: true },
        });
        if (!row) throw sourceNotFound();
        return {
          sourceType,
          patientId: row.patientId,
          clinicalEncounterId: row.clinicalEncounterId,
          sourceVersion: row.version,
          sourceStatus: row.status,
          documentType: ClinicalDocumentType.PROCEDURE_REPORT,
          title: row.kind === 'SURGERY' ? 'Informe de cirugía' : 'Informe de procedimiento',
          patientName: row.patientNameSnapshot,
          ownerName: row.ownerDisplayNameSnapshot,
          professionalName: row.professionalDisplayNameSnapshot,
          clinicalDate: row.performedAt,
          fields: [
            { label: 'Licencia profesional', value: row.professionalLicenseSnapshot },
            { label: 'Tipo', value: row.kind },
            { label: 'Procedimiento', value: row.procedureName },
            { label: 'Realizado el', value: row.performedAt },
            { label: 'Indicación', value: row.indication },
            { label: 'Descripción', value: row.description },
            { label: 'Técnica', value: row.technique },
            { label: 'Hallazgos', value: row.findings },
            { label: 'Complicaciones', value: row.complications },
            { label: 'Recuperación', value: row.recoveryNotes },
            { label: 'Plan posoperatorio', value: row.postoperativePlan },
            { label: 'Notas', value: row.notes },
            { label: 'Área quirúrgica', value: row.surgeryDetail?.surgicalArea },
            { label: 'Lado', value: row.surgeryDetail?.surgicalSide },
            { label: 'Sangrado', value: row.surgeryDetail?.bleedingNotes },
            { label: 'Cierre', value: row.surgeryDetail?.closureNotes },
            { label: 'Asistente', value: row.surgeryDetail?.assistantDisplayNameSnapshot },
          ],
        };
      }
      case ClinicalDocumentSourceType.ANESTHESIA_RECORD: {
        const row = await tx.anesthesiaRecord.findFirst({
          where: { id: sourceId, organizationId },
          include: { observations: { orderBy: [{ observedAt: 'asc' }, { id: 'asc' }] } },
        });
        if (!row) throw sourceNotFound();
        return {
          sourceType,
          patientId: row.patientId,
          clinicalEncounterId: row.clinicalEncounterId,
          sourceVersion: row.version,
          sourceStatus: row.status,
          documentType: ClinicalDocumentType.ANESTHESIA_REPORT,
          title: 'Informe anestésico',
          patientName: row.patientNameSnapshot,
          ownerName: row.ownerDisplayNameSnapshot,
          professionalName: row.professionalDisplayNameSnapshot,
          clinicalDate: row.startedAt,
          fields: [
            { label: 'Licencia profesional', value: row.professionalLicenseSnapshot },
            { label: 'Inicio', value: row.startedAt },
            { label: 'Fin', value: row.endedAt },
            { label: 'ASA', value: row.asaClassification },
            { label: 'Técnica', value: row.technique },
            { label: 'Preanestesia', value: row.preAnestheticAssessment },
            { label: 'Medicamentos', value: row.medicationsText },
            { label: 'Vía aérea', value: row.airwayManagement },
            { label: 'Fluidos', value: row.fluidsText },
            { label: 'Complicaciones', value: row.complications },
            { label: 'Recuperación', value: row.recoveryNotes },
            { label: 'Notas', value: row.notes },
            ...row.observations.flatMap((observation, index) => [
              { label: `Observación ${index + 1}`, value: observation.observedAt },
              ...optionalField('FC (lpm)', observation.heartRateBpm),
              ...optionalField('FR (rpm)', observation.respiratoryRatePerMinute),
              ...optionalField('Temperatura (°C)', observation.temperatureC),
              ...optionalField('Presión arterial', observation.bloodPressureText),
              ...optionalField('SpO₂ (%)', observation.spo2Percent),
              ...optionalField('EtCO₂ (mmHg)', observation.etco2MmHg),
              ...optionalField('Plano anestésico', observation.anestheticPlane),
              ...optionalField('Notas de observación', observation.notes),
            ]),
          ],
        };
      }
      case ClinicalDocumentSourceType.HOSPITALIZATION: {
        const row = await tx.hospitalization.findFirst({ where: { id: sourceId, organizationId } });
        if (!row) throw sourceNotFound();
        return {
          sourceType,
          patientId: row.patientId,
          clinicalEncounterId: row.clinicalEncounterId,
          sourceVersion: row.version,
          sourceStatus: row.status,
          documentType: ClinicalDocumentType.HOSPITALIZATION_DISCHARGE,
          title: 'Informe de egreso hospitalario',
          patientName: row.patientNameSnapshot,
          ownerName: row.ownerDisplayNameSnapshot,
          professionalName: row.professionalDisplayNameSnapshot,
          clinicalDate: row.dischargedAt,
          fields: [
            { label: 'Licencia profesional', value: row.professionalLicenseSnapshot },
            { label: 'Ingreso', value: row.admittedAt },
            { label: 'Egreso', value: row.dischargedAt },
            { label: 'Ubicación', value: row.locationName },
            { label: 'Motivo de ingreso', value: row.admissionReason },
            { label: 'Diagnóstico', value: row.diagnosis },
            { label: 'Plan terapéutico', value: row.treatmentPlan },
            { label: 'Medicamentos', value: row.medicationsText },
            { label: 'Dieta', value: row.dietInstructions },
            { label: 'Resumen de egreso', value: row.dischargeSummary },
            { label: 'Recomendaciones', value: row.dischargeRecommendations },
          ],
        };
      }
      case ClinicalDocumentSourceType.DIAGNOSTIC_ORDER: {
        const row = await tx.diagnosticOrder.findFirst({ where: { id: sourceId, organizationId } });
        if (!row) throw sourceNotFound();
        return {
          sourceType,
          patientId: row.patientId,
          clinicalEncounterId: row.clinicalEncounterId,
          sourceVersion: row.version,
          sourceStatus: row.status,
          documentType: ClinicalDocumentType.DIAGNOSTIC_RESULT,
          title: 'Resultado diagnóstico',
          patientName: row.patientNameSnapshot,
          ownerName: row.ownerDisplayNameSnapshot,
          professionalName: row.professionalDisplayNameSnapshot,
          clinicalDate: row.resultedAt,
          fields: [
            { label: 'Licencia profesional', value: row.professionalLicenseSnapshot },
            { label: 'Categoría', value: row.category },
            { label: 'Prueba', value: row.testName },
            { label: 'Solicitado', value: row.requestedAt },
            { label: 'Motivo', value: row.reason },
            { label: 'Instrucciones', value: row.instructions },
            { label: 'Resultado', value: row.resultText },
            { label: 'Interpretación', value: row.interpretation },
            { label: 'Resultado emitido', value: row.resultedAt },
          ],
        };
      }
      case ClinicalDocumentSourceType.CONSENT: {
        const row = await tx.consent.findFirst({
          where: { id: sourceId, organizationId },
          include: {
            signatureRequests: {
              where: { status: 'SIGNED' },
              orderBy: { signedAt: 'desc' },
              take: 1,
            },
          },
        });
        if (!row) throw sourceNotFound();
        const request = row.signatureRequests[0];
        const signatureImage = request?.signatureStorageKey
          ? await this.storage.get(request.signatureStorageKey)
          : undefined;
        return {
          sourceType,
          patientId: row.patientId,
          clinicalEncounterId: row.clinicalEncounterId,
          sourceVersion: row.version,
          sourceStatus: row.status,
          documentType: ClinicalDocumentType.SIGNED_CONSENT,
          title: `Consentimiento firmado: ${row.title}`,
          patientName: row.patientNameSnapshot,
          ownerName: row.ownerDisplayNameSnapshot,
          professionalName: row.professionalDisplayNameSnapshot,
          clinicalDate: request?.signedAt,
          signatureImage,
          evidenceSha256: request?.evidenceSha256 ?? undefined,
          fields: [
            { label: 'Licencia profesional', value: row.professionalLicenseSnapshot },
            { label: 'Propósito', value: row.purposeText },
            { label: 'Riesgos', value: row.risksText },
            { label: 'Beneficios', value: row.benefitsText },
            { label: 'Alternativas', value: row.alternativesText },
            { label: 'Costo estimado', value: row.estimatedCostText },
            { label: 'Declaración', value: row.declarationText },
            { label: 'Firmante', value: request?.signerName },
            { label: 'Método de aceptación', value: request?.signatureMethod },
            { label: 'Fecha de firma', value: request?.signedAt },
          ],
        };
      }
    }
  }

  private toPdfInput(
    source: PdfSource,
    documentId: string,
    organizationName: string,
    generatedAt: Date,
  ): ClinicalPdfInput {
    return {
      title: source.title,
      organizationName,
      patientName: source.patientName,
      ownerName: source.ownerName,
      professionalName: source.professionalName,
      clinicalDate: source.clinicalDate,
      documentId,
      generatedAt,
      fields: source.fields,
      signatureImage: source.signatureImage,
      evidenceSha256: source.evidenceSha256,
      statusNotice:
        source.sourceStatus === 'VOIDED' ? 'El registro clínico de origen fue anulado.' : undefined,
    };
  }

  private async sourceStatus(
    client: PrismaService | Prisma.TransactionClient,
    sourceType: ClinicalDocumentSourceType,
    sourceId: string,
    organizationId: string,
  ): Promise<string | null> {
    switch (sourceType) {
      case 'PRESCRIPTION':
        return (
          (
            await client.prescription.findFirst({
              where: { id: sourceId, organizationId },
              select: { status: true },
            })
          )?.status ?? null
        );
      case 'VACCINATION':
        return (
          (
            await client.vaccination.findFirst({
              where: { id: sourceId, organizationId },
              select: { status: true },
            })
          )?.status ?? null
        );
      case 'CLINICAL_PROCEDURE':
        return (
          (
            await client.clinicalProcedure.findFirst({
              where: { id: sourceId, organizationId },
              select: { status: true },
            })
          )?.status ?? null
        );
      case 'ANESTHESIA_RECORD':
        return (
          (
            await client.anesthesiaRecord.findFirst({
              where: { id: sourceId, organizationId },
              select: { status: true },
            })
          )?.status ?? null
        );
      case 'HOSPITALIZATION':
        return (
          (
            await client.hospitalization.findFirst({
              where: { id: sourceId, organizationId },
              select: { status: true },
            })
          )?.status ?? null
        );
      case 'DIAGNOSTIC_ORDER':
        return (
          (
            await client.diagnosticOrder.findFirst({
              where: { id: sourceId, organizationId },
              select: { status: true },
            })
          )?.status ?? null
        );
      case 'CONSENT':
        return (
          (
            await client.consent.findFirst({
              where: { id: sourceId, organizationId },
              select: { status: true },
            })
          )?.status ?? null
        );
    }
  }

  private assertUpload(file: UploadedFile): void {
    if (
      !file?.buffer ||
      file.size < 1 ||
      file.size > MAX_UPLOAD_BYTES ||
      file.size !== file.buffer.byteLength
    ) {
      throw new BadRequestException({
        code: 'FILE_SIZE_INVALID',
        message: 'El archivo debe pesar hasta 10 MB.',
      });
    }
    const signatures: Record<string, (buffer: Buffer) => boolean> = {
      'application/pdf': (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
      'image/png': (buffer) =>
        buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'image/jpeg': (buffer) =>
        buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    };
    const validator = signatures[file.mimetype];
    if (!validator || !validator(file.buffer)) {
      throw new BadRequestException({
        code: 'FILE_TYPE_INVALID',
        message: 'Solo se aceptan PDF, PNG o JPEG válidos.',
      });
    }
  }
}

// Derives metadata from the stored byte stream so browser or multipart hashes are never trusted.
function toMetadata(document: DocumentMetadataRecord): DocumentMetadata {
  return {
    id: document.id,
    patientId: document.patientId,
    clinicalEncounterId: document.clinicalEncounterId,
    origin: document.origin,
    status: document.status,
    documentType: document.documentType,
    title: document.title,
    originalFileName: document.originalFileName,
    sourceType: document.sourceType,
    sourceId: document.sourceId,
    sourceVersion: document.sourceVersion,
    mimeType: document.mimeType,
    sizeBytes: Number(document.sizeBytes),
    sha256: document.sha256,
    voidReason: document.voidReason,
    voidedAt: document.voidedAt,
    createdAt: document.createdAt,
  };
}

// Maps only accepted output document types to one controlled clinical source type.
function sourceTypeForDocumentType(documentType: ClinicalDocumentType): ClinicalDocumentSourceType {
  const mapping: Partial<Record<ClinicalDocumentType, ClinicalDocumentSourceType>> = {
    PRESCRIPTION: ClinicalDocumentSourceType.PRESCRIPTION,
    VACCINATION_CERTIFICATE: ClinicalDocumentSourceType.VACCINATION,
    PROCEDURE_REPORT: ClinicalDocumentSourceType.CLINICAL_PROCEDURE,
    ANESTHESIA_REPORT: ClinicalDocumentSourceType.ANESTHESIA_RECORD,
    HOSPITALIZATION_DISCHARGE: ClinicalDocumentSourceType.HOSPITALIZATION,
    DIAGNOSTIC_RESULT: ClinicalDocumentSourceType.DIAGNOSTIC_ORDER,
    SIGNED_CONSENT: ClinicalDocumentSourceType.CONSENT,
  };
  const sourceType = mapping[documentType];
  if (!sourceType)
    throw new BadRequestException({
      code: 'DOCUMENT_TYPE_NOT_GENERATABLE',
      message: 'This document type cannot be generated from a clinical source',
    });
  return sourceType;
}

// A source is locked before it is read so finalization/void cannot race with artifact creation.
async function lockTenantSource(
  tx: Prisma.TransactionClient,
  sourceType: ClinicalDocumentSourceType,
  sourceId: string,
  organizationId: string,
): Promise<void> {
  const table = SOURCE_TABLE[sourceType];
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "${table}" WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
    sourceId,
    organizationId,
  );
  if (!rows.length) throw sourceNotFound();
}

// Parent Encounter is always acquired before Patient and clinical source locks to prevent lifecycle deadlocks.
async function lockTenantEncounter(
  tx: Prisma.TransactionClient,
  organizationId: string,
  patientId: string,
  encounterId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM clinical_encounters
    WHERE id = ${encounterId}::uuid AND organization_id = ${organizationId}::uuid
      AND patient_id = ${patientId}::uuid
    FOR UPDATE
  `;
  if (!rows.length)
    throw new NotFoundException({ code: 'ENCOUNTER_NOT_FOUND', message: 'Encounter not found' });
}

// Patient row locks serialize uploads against archive operations without broad cross-tenant reads.
async function lockPatient(
  tx: Prisma.TransactionClient,
  patientId: string,
  organizationId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM patients WHERE id = ${patientId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE
  `;
  if (!rows.length)
    throw new NotFoundException({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
}

// Optional observations use null checks instead of truthiness so zero-valued vital signs are retained.
function optionalField(label: string, value: unknown): PdfField[] {
  return value === null || value === undefined
    ? []
    : [{ label, value: value as string | number | Date }];
}

function assertEligibleSource(source: PdfSource): void {
  if (source.documentType === ClinicalDocumentType.SIGNED_CONSENT) {
    if (source.sourceStatus !== 'SIGNED')
      throw new ConflictException({
        code: 'SOURCE_NOT_FINALIZED',
        message: 'Only signed consents can be generated',
      });
    return;
  }
  const expected =
    source.sourceType === ClinicalDocumentSourceType.HOSPITALIZATION
      ? 'DISCHARGED'
      : source.sourceType === ClinicalDocumentSourceType.DIAGNOSTIC_ORDER
        ? 'RESULTED'
        : 'FINALIZED';
  if (source.sourceStatus === 'VOIDED')
    throw new ConflictException({
      code: 'SOURCE_VOIDED',
      message: 'Voided clinical sources cannot generate documents',
    });
  if (source.sourceStatus !== expected)
    throw new ConflictException({
      code: 'SOURCE_NOT_FINALIZED',
      message: 'Only finalized clinical sources can generate documents',
    });
}

function sourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'SOURCE_NOT_FOUND', message: 'Clinical source not found' });
}

// Loads parent status in bounded per-type queries so patient lists can warn about voided sources without N+1 lookups.
async function loadSourceStatuses(
  client: PrismaService,
  organizationId: string,
  documents: Array<{
    sourceType: ClinicalDocumentSourceType | null;
    sourceId: string | null;
  }>,
): Promise<Map<string, string>> {
  const identifiers = new Map<ClinicalDocumentSourceType, Set<string>>();
  for (const document of documents) {
    if (!document.sourceType || !document.sourceId) continue;
    const ids = identifiers.get(document.sourceType) ?? new Set<string>();
    ids.add(document.sourceId);
    identifiers.set(document.sourceType, ids);
  }
  const groups = [...identifiers];
  const statuses = await Promise.all(
    groups.map(async ([sourceType, ids]) => {
      const table = SOURCE_TABLE[sourceType];
      return client.$queryRawUnsafe<Array<{ id: string; status: string }>>(
        `SELECT id, status::text AS status FROM "${table}" WHERE organization_id = $1::uuid AND id = ANY($2::uuid[])`,
        organizationId,
        [...ids],
      );
    }),
  );
  const result = new Map<string, string>();
  statuses.forEach((rows, groupIndex) => {
    const sourceType = groups[groupIndex]![0];
    for (const row of rows) result.set(`${sourceType}:${row.id}`, row.status);
  });
  return result;
}

// Resolves only parent IDs and status for lock ordering; callers must lock then re-read before mutation.
async function linkedSourceContext(
  tx: Prisma.TransactionClient,
  sourceType: ClinicalDocumentSourceType,
  sourceId: string,
  organizationId: string,
): Promise<{ patientId: string; clinicalEncounterId: string; status: string } | null> {
  const table = SOURCE_TABLE[sourceType];
  const rows = await tx.$queryRawUnsafe<
    Array<{ patientId: string; clinicalEncounterId: string; status: string }>
  >(
    `SELECT patient_id AS "patientId", clinical_encounter_id AS "clinicalEncounterId", status::text AS status FROM "${table}" WHERE id = $1::uuid AND organization_id = $2::uuid`,
    sourceId,
    organizationId,
  );
  return rows[0] ?? null;
}

// Removes path fragments and control characters while preserving a display-only upload name.
function sanitizeOriginalFilename(input: string): string {
  const leaf = input.replace(/\\/g, '/').split('/').pop() ?? 'document';
  const safe = leaf
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(0, 255);
  return safe || 'document';
}
