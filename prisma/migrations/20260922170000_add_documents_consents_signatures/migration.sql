-- Adds V1 clinical document storage and consent-signature evidence. Existing clinical rows are untouched.
CREATE TYPE "ClinicalDocumentOrigin" AS ENUM ('GENERATED', 'UPLOADED');
CREATE TYPE "ClinicalDocumentStatus" AS ENUM ('ACTIVE', 'VOIDED');
CREATE TYPE "ClinicalDocumentType" AS ENUM (
  'PRESCRIPTION', 'VACCINATION_CERTIFICATE', 'PROCEDURE_REPORT', 'ANESTHESIA_REPORT',
  'HOSPITALIZATION_DISCHARGE', 'DIAGNOSTIC_RESULT', 'SIGNED_CONSENT', 'CLINICAL_ATTACHMENT'
);
CREATE TYPE "ClinicalDocumentSourceType" AS ENUM (
  'PRESCRIPTION', 'VACCINATION', 'CLINICAL_PROCEDURE', 'ANESTHESIA_RECORD',
  'HOSPITALIZATION', 'DIAGNOSTIC_ORDER', 'CONSENT'
);
CREATE TYPE "ConsentStatus" AS ENUM ('DRAFT', 'ISSUED', 'SIGNED', 'VOIDED');
CREATE TYPE "ConsentSignatureRequestStatus" AS ENUM ('PENDING', 'SIGNED', 'REVOKED');
CREATE TYPE "ConsentSignatureMethod" AS ENUM ('TYPED', 'DRAWN');

ALTER TYPE "ClinicalAuditAction" ADD VALUE 'DOCUMENT_GENERATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'DOCUMENT_UPLOADED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'DOCUMENT_VOIDED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'CONSENT_CREATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'CONSENT_UPDATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'CONSENT_ISSUED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'CONSENT_SIGNED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'CONSENT_VOIDED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'SIGNATURE_REQUEST_REISSUED';
ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'CLINICAL_DOCUMENT';
ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'CONSENT';

CREATE TABLE "clinical_documents" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "clinical_encounter_id" UUID,
  "origin" "ClinicalDocumentOrigin" NOT NULL,
  "status" "ClinicalDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "document_type" "ClinicalDocumentType" NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "original_file_name" VARCHAR(255),
  "source_type" "ClinicalDocumentSourceType",
  "source_id" UUID,
  "source_version" INTEGER,
  "mime_type" VARCHAR(100) NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "created_by_membership_id" UUID NOT NULL,
  "voided_at" TIMESTAMPTZ(3),
  "voided_by_membership_id" UUID,
  "void_reason" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_documents_source_pair_check" CHECK (("source_type" IS NULL) = ("source_id" IS NULL)),
  CONSTRAINT "clinical_documents_generated_source_check" CHECK (
    "origin" <> 'GENERATED' OR ("source_type" IS NOT NULL AND "source_id" IS NOT NULL AND "source_version" > 0)
  ),
  CONSTRAINT "clinical_documents_size_check" CHECK ("size_bytes" > 0),
  CONSTRAINT "clinical_documents_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "clinical_documents_void_state_check" CHECK (
    ("status" = 'ACTIVE' AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL)
    OR ("status" = 'VOIDED' AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL AND length(trim(coalesce("void_reason", ''))) > 0)
  )
);

CREATE TABLE "consents" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "clinical_encounter_id" UUID NOT NULL,
  "clinical_procedure_id" UUID,
  "status" "ConsentStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" VARCHAR(300) NOT NULL,
  "purpose_text" VARCHAR(10000),
  "risks_text" VARCHAR(10000),
  "benefits_text" VARCHAR(10000),
  "alternatives_text" VARCHAR(10000),
  "estimated_cost_text" VARCHAR(2000),
  "declaration_text" VARCHAR(10000),
  "responsible_practitioner_membership_id" UUID,
  "created_by_membership_id" UUID NOT NULL,
  "patient_name_snapshot" VARCHAR(200),
  "owner_display_name_snapshot" VARCHAR(300),
  "owner_document_type_snapshot" VARCHAR(80),
  "owner_document_number_snapshot" VARCHAR(160),
  "professional_display_name_snapshot" VARCHAR(200),
  "professional_license_snapshot" VARCHAR(160),
  "content_sha256" CHAR(64),
  "issued_at" TIMESTAMPTZ(3),
  "issued_by_membership_id" UUID,
  "signed_at" TIMESTAMPTZ(3),
  "voided_at" TIMESTAMPTZ(3),
  "voided_by_membership_id" UUID,
  "void_reason" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consents_version_check" CHECK ("version" >= 1),
  CONSTRAINT "consents_hash_check" CHECK ("content_sha256" IS NULL OR "content_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "consents_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "issued_at" IS NULL AND "issued_by_membership_id" IS NULL AND "signed_at" IS NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NULL AND "owner_display_name_snapshot" IS NULL
      AND "professional_display_name_snapshot" IS NULL AND "content_sha256" IS NULL)
    OR ("status" = 'ISSUED' AND "issued_at" IS NOT NULL AND "issued_by_membership_id" IS NOT NULL
      AND "signed_at" IS NULL AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NOT NULL AND "owner_display_name_snapshot" IS NOT NULL
      AND "professional_display_name_snapshot" IS NOT NULL AND "content_sha256" IS NOT NULL)
    OR ("status" = 'SIGNED' AND "issued_at" IS NOT NULL AND "issued_by_membership_id" IS NOT NULL AND "signed_at" IS NOT NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NOT NULL AND "owner_display_name_snapshot" IS NOT NULL
      AND "professional_display_name_snapshot" IS NOT NULL AND "content_sha256" IS NOT NULL)
    OR ("status" = 'VOIDED' AND "issued_at" IS NOT NULL AND "issued_by_membership_id" IS NOT NULL
      AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL AND length(trim(coalesce("void_reason", ''))) > 0
      AND "patient_name_snapshot" IS NOT NULL AND "owner_display_name_snapshot" IS NOT NULL
      AND "professional_display_name_snapshot" IS NOT NULL AND "content_sha256" IS NOT NULL)
  )
);

CREATE TABLE "consent_signature_requests" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "consent_id" UUID NOT NULL,
  "status" "ConsentSignatureRequestStatus" NOT NULL DEFAULT 'PENDING',
  "token_hash" CHAR(64) NOT NULL,
  "otp_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "created_by_membership_id" UUID NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "revoked_by_membership_id" UUID,
  "signed_at" TIMESTAMPTZ(3),
  "signer_name" VARCHAR(300),
  "signature_method" "ConsentSignatureMethod",
  "signature_storage_key" VARCHAR(500),
  "signature_sha256" CHAR(64),
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(500),
  "evidence_sha256" CHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_signature_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consent_signature_requests_attempts_check" CHECK ("failed_attempts" >= 0 AND "max_attempts" > 0),
  CONSTRAINT "consent_signature_requests_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "consent_signature_requests_token_hash_check" CHECK ("token_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "consent_signature_requests_evidence_check" CHECK (
    ("evidence_sha256" IS NULL OR "evidence_sha256" ~ '^[a-f0-9]{64}$')
    AND ("signature_sha256" IS NULL OR "signature_sha256" ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT "consent_signature_requests_lifecycle_check" CHECK (
    ("status" = 'PENDING' AND "revoked_at" IS NULL AND "revoked_by_membership_id" IS NULL AND "signed_at" IS NULL
      AND "signer_name" IS NULL AND "signature_method" IS NULL AND "signature_storage_key" IS NULL
      AND "signature_sha256" IS NULL AND "evidence_sha256" IS NULL)
    OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL AND "revoked_by_membership_id" IS NOT NULL AND "signed_at" IS NULL
      AND "signer_name" IS NULL AND "signature_method" IS NULL AND "signature_storage_key" IS NULL
      AND "signature_sha256" IS NULL AND "evidence_sha256" IS NULL)
    OR ("status" = 'SIGNED' AND "revoked_at" IS NULL AND "revoked_by_membership_id" IS NULL
      AND "signed_at" IS NOT NULL AND length(trim(coalesce("signer_name", ''))) > 0
      AND "signature_method" IS NOT NULL AND "evidence_sha256" IS NOT NULL
      AND (("signature_method" = 'DRAWN' AND "signature_storage_key" IS NOT NULL AND "signature_sha256" IS NOT NULL)
        OR ("signature_method" = 'TYPED' AND "signature_storage_key" IS NULL AND "signature_sha256" IS NULL)))
  )
);

CREATE UNIQUE INDEX "clinical_documents_storage_key_key" ON "clinical_documents"("storage_key");
CREATE UNIQUE INDEX "clinical_documents_id_organization_id_key" ON "clinical_documents"("id", "organization_id");
CREATE UNIQUE INDEX "clinical_documents_generated_source_key" ON "clinical_documents"("organization_id", "document_type", "source_type", "source_id", "source_version");
CREATE INDEX "clinical_documents_org_patient_created_idx" ON "clinical_documents"("organization_id", "patient_id", "created_at" DESC, "id");
CREATE INDEX "clinical_documents_organization_id_clinical_encounter_id_idx" ON "clinical_documents"("organization_id", "clinical_encounter_id");
CREATE INDEX "clinical_documents_organization_id_status_document_type_idx" ON "clinical_documents"("organization_id", "status", "document_type");

CREATE UNIQUE INDEX "consents_id_organization_id_key" ON "consents"("id", "organization_id");
CREATE INDEX "consents_org_patient_created_idx" ON "consents"("organization_id", "patient_id", "created_at" DESC, "id");
CREATE INDEX "consents_organization_id_clinical_encounter_id_idx" ON "consents"("organization_id", "clinical_encounter_id");
CREATE INDEX "consents_organization_id_status_idx" ON "consents"("organization_id", "status");

CREATE UNIQUE INDEX "consent_signature_requests_token_hash_key" ON "consent_signature_requests"("token_hash");
CREATE UNIQUE INDEX "consent_signature_requests_id_organization_id_key" ON "consent_signature_requests"("id", "organization_id");
CREATE UNIQUE INDEX "consent_signature_requests_one_pending_idx" ON "consent_signature_requests"("consent_id", "organization_id") WHERE "status" = 'PENDING';
CREATE INDEX "consent_signature_requests_organization_id_consent_id_created_at_idx" ON "consent_signature_requests"("organization_id", "consent_id", "created_at" DESC);
CREATE INDEX "consent_signature_requests_organization_id_status_expires_at_idx" ON "consent_signature_requests"("organization_id", "status", "expires_at");

ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_clinical_encounter_id_organization_id_patient_id_fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id") REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consents" ADD CONSTRAINT "consents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_clinical_encounter_id_organization_id_patient_id_fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id") REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_clinical_procedure_id_organization_id_patient_id_clinical_encounter_id_fkey" FOREIGN KEY ("clinical_procedure_id", "organization_id", "patient_id", "clinical_encounter_id") REFERENCES "clinical_procedures"("id", "organization_id", "patient_id", "clinical_encounter_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_responsible_practitioner_membership_id_organization_id_fkey" FOREIGN KEY ("responsible_practitioner_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_issued_by_membership_id_organization_id_fkey" FOREIGN KEY ("issued_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consent_signature_requests" ADD CONSTRAINT "consent_signature_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_signature_requests" ADD CONSTRAINT "consent_signature_requests_consent_id_organization_id_fkey" FOREIGN KEY ("consent_id", "organization_id") REFERENCES "consents"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_signature_requests" ADD CONSTRAINT "consent_signature_requests_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consent_signature_requests" ADD CONSTRAINT "consent_signature_requests_revoked_by_membership_id_organization_id_fkey" FOREIGN KEY ("revoked_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
