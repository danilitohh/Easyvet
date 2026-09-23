-- CreateEnum
CREATE TYPE "ClinicalFollowUpStatus" AS ENUM ('OPEN', 'COMPLETED', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClinicalAuditAction" ADD VALUE 'FOLLOW_UP_CREATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'FOLLOW_UP_UPDATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'FOLLOW_UP_COMPLETED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'FOLLOW_UP_VOIDED';

-- AlterEnum
ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'CLINICAL_FOLLOW_UP';

-- DropIndex
DROP INDEX "diagnostic_orders_org_category_requested_idx";

-- DropIndex
DROP INDEX "diagnostic_orders_org_encounter_requested_idx";

-- DropIndex
DROP INDEX "diagnostic_orders_org_patient_requested_created_idx";

-- DropIndex
DROP INDEX "diagnostic_orders_org_status_requested_idx";

-- DropIndex
DROP INDEX "hospitalizations_org_patient_admitted_created_idx";

-- CreateTable
CREATE TABLE "clinical_follow_ups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "source_clinical_encounter_id" UUID,
    "status" "ClinicalFollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(200) NOT NULL,
    "reason" VARCHAR(2000),
    "due_on" DATE NOT NULL,
    "reminder_at" TIMESTAMPTZ(3),
    "assigned_membership_id" UUID,
    "notes" TEXT,
    "created_by_membership_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_membership_id" UUID,
    "outcome" VARCHAR(4000),
    "completion_notes" TEXT,
    "patient_name_snapshot" VARCHAR(200),
    "owner_display_name_snapshot" VARCHAR(320),
    "professional_display_name_snapshot" VARCHAR(160),
    "professional_license_snapshot" VARCHAR(80),
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "void_reason" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_follow_ups_pkey" PRIMARY KEY ("id")
);

-- Enforce lifecycle completeness in PostgreSQL as a final guard against invalid direct writes.
ALTER TABLE "clinical_follow_ups"
  ADD CONSTRAINT "clinical_follow_ups_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "clinical_follow_ups_lifecycle_check" CHECK (
    (
      "status" = 'OPEN'
      AND "completed_at" IS NULL
      AND "completed_by_membership_id" IS NULL
      AND "outcome" IS NULL
      AND "completion_notes" IS NULL
      AND "patient_name_snapshot" IS NULL
      AND "owner_display_name_snapshot" IS NULL
      AND "professional_display_name_snapshot" IS NULL
      AND "professional_license_snapshot" IS NULL
      AND "voided_at" IS NULL
      AND "voided_by_membership_id" IS NULL
      AND "void_reason" IS NULL
    ) OR (
      "status" = 'COMPLETED'
      AND "completed_at" IS NOT NULL
      AND "completed_by_membership_id" IS NOT NULL
      AND NULLIF(BTRIM("outcome"), '') IS NOT NULL
      AND "patient_name_snapshot" IS NOT NULL
      AND "owner_display_name_snapshot" IS NOT NULL
      AND "professional_display_name_snapshot" IS NOT NULL
      AND "voided_at" IS NULL
      AND "voided_by_membership_id" IS NULL
      AND "void_reason" IS NULL
    ) OR (
      "status" = 'VOIDED'
      AND "voided_at" IS NOT NULL
      AND "voided_by_membership_id" IS NOT NULL
      AND NULLIF(BTRIM("void_reason"), '') IS NOT NULL
      AND (
        ("completed_at" IS NULL AND "completed_by_membership_id" IS NULL AND "outcome" IS NULL
          AND "patient_name_snapshot" IS NULL AND "owner_display_name_snapshot" IS NULL
          AND "professional_display_name_snapshot" IS NULL AND "professional_license_snapshot" IS NULL)
        OR
        ("completed_at" IS NOT NULL AND "completed_by_membership_id" IS NOT NULL
          AND NULLIF(BTRIM("outcome"), '') IS NOT NULL AND "patient_name_snapshot" IS NOT NULL
          AND "owner_display_name_snapshot" IS NOT NULL AND "professional_display_name_snapshot" IS NOT NULL)
      )
    )
  );

-- CreateIndex
CREATE INDEX "clinical_follow_ups_org_status_due_idx" ON "clinical_follow_ups"("organization_id", "status", "due_on", "created_at");

-- CreateIndex
CREATE INDEX "clinical_follow_ups_org_patient_due_idx" ON "clinical_follow_ups"("organization_id", "patient_id", "due_on", "created_at");

-- CreateIndex
CREATE INDEX "clinical_follow_ups_org_assignee_idx" ON "clinical_follow_ups"("organization_id", "assigned_membership_id", "status", "due_on");

-- CreateIndex
CREATE INDEX "clinical_follow_ups_org_encounter_idx" ON "clinical_follow_ups"("organization_id", "source_clinical_encounter_id");

-- CreateIndex
CREATE INDEX "clinical_follow_ups_org_reminder_idx" ON "clinical_follow_ups"("organization_id", "status", "reminder_at");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_follow_ups_id_org_key" ON "clinical_follow_ups"("id", "organization_id");

-- CreateIndex
CREATE INDEX "diagnostic_orders_organization_id_patient_id_requested_at_c_idx" ON "diagnostic_orders"("organization_id", "patient_id", "requested_at", "created_at");

-- CreateIndex
CREATE INDEX "diagnostic_orders_organization_id_clinical_encounter_id_req_idx" ON "diagnostic_orders"("organization_id", "clinical_encounter_id", "requested_at");

-- CreateIndex
CREATE INDEX "diagnostic_orders_organization_id_status_requested_at_idx" ON "diagnostic_orders"("organization_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "diagnostic_orders_organization_id_category_requested_at_idx" ON "diagnostic_orders"("organization_id", "category", "requested_at");

-- CreateIndex
CREATE INDEX "hospitalizations_org_patient_admitted_created_idx" ON "hospitalizations"("organization_id", "patient_id", "admitted_at", "created_at");

-- RenameForeignKey
ALTER TABLE "clinical_documents" RENAME CONSTRAINT "clinical_documents_clinical_encounter_id_organization_id_patien" TO "clinical_documents_clinical_encounter_id_organization_id_p_fkey";

-- RenameForeignKey
ALTER TABLE "clinical_documents" RENAME CONSTRAINT "clinical_documents_created_by_membership_id_organization_id_fke" TO "clinical_documents_created_by_membership_id_organization_i_fkey";

-- RenameForeignKey
ALTER TABLE "consent_signature_requests" RENAME CONSTRAINT "consent_signature_requests_created_by_membership_id_organizatio" TO "consent_signature_requests_created_by_membership_id_organi_fkey";

-- RenameForeignKey
ALTER TABLE "consent_signature_requests" RENAME CONSTRAINT "consent_signature_requests_revoked_by_membership_id_organizatio" TO "consent_signature_requests_revoked_by_membership_id_organi_fkey";

-- RenameForeignKey
ALTER TABLE "consents" RENAME CONSTRAINT "consents_clinical_procedure_id_organization_id_patient_id_clini" TO "consents_clinical_procedure_id_organization_id_patient_id__fkey";

-- RenameForeignKey
ALTER TABLE "consents" RENAME CONSTRAINT "consents_responsible_practitioner_membership_id_organization_id" TO "consents_responsible_practitioner_membership_id_organizati_fkey";

-- RenameForeignKey
ALTER TABLE "diagnostic_orders" RENAME CONSTRAINT "diagnostic_orders_created_by_membership_org_fkey" TO "diagnostic_orders_created_by_membership_id_organization_id_fkey";

-- RenameForeignKey
ALTER TABLE "diagnostic_orders" RENAME CONSTRAINT "diagnostic_orders_encounter_org_patient_fkey" TO "diagnostic_orders_clinical_encounter_id_organization_id_pa_fkey";

-- RenameForeignKey
ALTER TABLE "diagnostic_orders" RENAME CONSTRAINT "diagnostic_orders_patient_org_fkey" TO "diagnostic_orders_patient_id_organization_id_fkey";

-- RenameForeignKey
ALTER TABLE "diagnostic_orders" RENAME CONSTRAINT "diagnostic_orders_requested_by_membership_org_fkey" TO "diagnostic_orders_requested_by_membership_id_organization__fkey";

-- RenameForeignKey
ALTER TABLE "diagnostic_orders" RENAME CONSTRAINT "diagnostic_orders_responsible_membership_org_fkey" TO "diagnostic_orders_responsible_practitioner_membership_id_o_fkey";

-- RenameForeignKey
ALTER TABLE "diagnostic_orders" RENAME CONSTRAINT "diagnostic_orders_resulted_by_membership_org_fkey" TO "diagnostic_orders_resulted_by_membership_id_organization_i_fkey";

-- RenameForeignKey
ALTER TABLE "diagnostic_orders" RENAME CONSTRAINT "diagnostic_orders_voided_by_membership_org_fkey" TO "diagnostic_orders_voided_by_membership_id_organization_id_fkey";

-- AddForeignKey
ALTER TABLE "clinical_follow_ups" ADD CONSTRAINT "clinical_follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_follow_ups" ADD CONSTRAINT "clinical_follow_ups_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_follow_ups" ADD CONSTRAINT "clinical_follow_ups_source_clinical_encounter_id_organizat_fkey" FOREIGN KEY ("source_clinical_encounter_id", "organization_id", "patient_id") REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_follow_ups" ADD CONSTRAINT "clinical_follow_ups_assigned_membership_id_organization_id_fkey" FOREIGN KEY ("assigned_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_follow_ups" ADD CONSTRAINT "clinical_follow_ups_created_by_membership_id_organization__fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_follow_ups" ADD CONSTRAINT "clinical_follow_ups_completed_by_membership_id_organizatio_fkey" FOREIGN KEY ("completed_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_follow_ups" ADD CONSTRAINT "clinical_follow_ups_voided_by_membership_id_organization_i_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "consent_signature_requests_organization_id_consent_id_created_a" RENAME TO "consent_signature_requests_organization_id_consent_id_creat_idx";

-- RenameIndex
ALTER INDEX "consent_signature_requests_organization_id_status_expires_at_id" RENAME TO "consent_signature_requests_organization_id_status_expires_a_idx";
