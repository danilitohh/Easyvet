-- CreateEnum
CREATE TYPE "ClinicalProcedureKind" AS ENUM ('PROCEDURE', 'SURGERY');

-- CreateEnum
CREATE TYPE "ClinicalProcedureStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOIDED');

-- AlterEnum
ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'CLINICAL_PROCEDURE';

-- CreateTable
CREATE TABLE "clinical_procedures" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinical_encounter_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "kind" "ClinicalProcedureKind" NOT NULL,
    "status" "ClinicalProcedureStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "procedure_name" VARCHAR(200),
    "performed_at" TIMESTAMPTZ(3),
    "indication" VARCHAR(5000),
    "description" VARCHAR(10000),
    "technique" VARCHAR(10000),
    "findings" VARCHAR(10000),
    "complications" VARCHAR(10000),
    "recovery_notes" VARCHAR(10000),
    "postoperative_plan" VARCHAR(10000),
    "notes" VARCHAR(10000),
    "created_by_membership_id" UUID NOT NULL,
    "responsible_practitioner_membership_id" UUID,
    "patient_name_snapshot" VARCHAR(200),
    "owner_display_name_snapshot" VARCHAR(200),
    "professional_display_name_snapshot" VARCHAR(200),
    "professional_license_snapshot" VARCHAR(160),
    "finalized_at" TIMESTAMPTZ(3),
    "finalized_by_membership_id" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "void_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_procedures_pkey" PRIMARY KEY ("id")
);

-- Lifecycle snapshots are absent in drafts and complete before a record can be finalized or voided.
ALTER TABLE "clinical_procedures"
ADD CONSTRAINT "clinical_procedures_version_positive_check"
CHECK ("version" >= 1);

ALTER TABLE "clinical_procedures"
ADD CONSTRAINT "clinical_procedures_lifecycle_check"
CHECK (
    (
        "status" = 'DRAFT'
        AND "patient_name_snapshot" IS NULL
        AND "owner_display_name_snapshot" IS NULL
        AND "professional_display_name_snapshot" IS NULL
        AND "professional_license_snapshot" IS NULL
        AND "finalized_at" IS NULL
        AND "finalized_by_membership_id" IS NULL
        AND "voided_at" IS NULL
        AND "voided_by_membership_id" IS NULL
        AND "void_reason" IS NULL
    )
    OR (
        "status" = 'FINALIZED'
        AND "performed_at" IS NOT NULL
        AND "procedure_name" IS NOT NULL AND btrim("procedure_name") <> ''
        AND "responsible_practitioner_membership_id" IS NOT NULL
        AND "patient_name_snapshot" IS NOT NULL AND btrim("patient_name_snapshot") <> ''
        AND "owner_display_name_snapshot" IS NOT NULL AND btrim("owner_display_name_snapshot") <> ''
        AND "professional_display_name_snapshot" IS NOT NULL AND btrim("professional_display_name_snapshot") <> ''
        AND "finalized_at" IS NOT NULL
        AND "finalized_by_membership_id" IS NOT NULL
        AND "voided_at" IS NULL
        AND "voided_by_membership_id" IS NULL
        AND "void_reason" IS NULL
    )
    OR (
        "status" = 'VOIDED'
        AND "performed_at" IS NOT NULL
        AND "procedure_name" IS NOT NULL AND btrim("procedure_name") <> ''
        AND "responsible_practitioner_membership_id" IS NOT NULL
        AND "patient_name_snapshot" IS NOT NULL AND btrim("patient_name_snapshot") <> ''
        AND "owner_display_name_snapshot" IS NOT NULL AND btrim("owner_display_name_snapshot") <> ''
        AND "professional_display_name_snapshot" IS NOT NULL AND btrim("professional_display_name_snapshot") <> ''
        AND "finalized_at" IS NOT NULL
        AND "finalized_by_membership_id" IS NOT NULL
        AND "voided_at" IS NOT NULL
        AND "voided_by_membership_id" IS NOT NULL
        AND "void_reason" IS NOT NULL AND btrim("void_reason") <> ''
    )
);

-- CreateTable
CREATE TABLE "clinical_surgery_details" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinical_procedure_id" UUID NOT NULL,
    "assistant_membership_id" UUID,
    "assistant_display_name_snapshot" VARCHAR(200),
    "surgical_area" VARCHAR(500),
    "surgical_side" VARCHAR(200),
    "bleeding_notes" VARCHAR(5000),
    "closure_notes" VARCHAR(5000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_surgery_details_pkey" PRIMARY KEY ("id")
);

-- Assistant identity snapshots are only present when an assistant is assigned and finalized.
ALTER TABLE "clinical_surgery_details"
ADD CONSTRAINT "clinical_surgery_details_assistant_snapshot_pair_check"
CHECK (
    "assistant_display_name_snapshot" IS NULL
    OR ("assistant_membership_id" IS NOT NULL AND btrim("assistant_display_name_snapshot") <> '')
);

-- CreateIndex
CREATE INDEX "clinical_procedures_organization_id_patient_id_performed_at_idx" ON "clinical_procedures"("organization_id", "patient_id", "performed_at", "created_at");

-- CreateIndex
CREATE INDEX "clinical_procedures_organization_id_clinical_encounter_id_idx" ON "clinical_procedures"("organization_id", "clinical_encounter_id");

-- CreateIndex
CREATE INDEX "clinical_procedures_organization_id_status_idx" ON "clinical_procedures"("organization_id", "status");

-- CreateIndex
CREATE INDEX "clinical_procedures_organization_id_kind_idx" ON "clinical_procedures"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "clinical_procedures_organization_id_responsible_practitione_idx" ON "clinical_procedures"("organization_id", "responsible_practitioner_membership_id", "performed_at");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_procedures_id_organization_id_key" ON "clinical_procedures"("id", "organization_id");

-- CreateIndex
CREATE INDEX "clinical_surgery_details_organization_id_assistant_membersh_idx" ON "clinical_surgery_details"("organization_id", "assistant_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_surgery_details_id_organization_id_key" ON "clinical_surgery_details"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_surgery_details_procedure_org_key" ON "clinical_surgery_details"("clinical_procedure_id", "organization_id");

-- AddForeignKey
ALTER TABLE "clinical_procedures" ADD CONSTRAINT "clinical_procedures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_procedures" ADD CONSTRAINT "clinical_procedures_clinical_encounter_id_organization_id__fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id") REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_procedures" ADD CONSTRAINT "clinical_procedures_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_procedures" ADD CONSTRAINT "clinical_procedures_created_by_membership_id_organization__fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_procedures" ADD CONSTRAINT "clinical_procedures_responsible_practitioner_membership_id_fkey" FOREIGN KEY ("responsible_practitioner_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_procedures" ADD CONSTRAINT "clinical_procedures_finalized_by_membership_id_organizatio_fkey" FOREIGN KEY ("finalized_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_procedures" ADD CONSTRAINT "clinical_procedures_voided_by_membership_id_organization_i_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_surgery_details" ADD CONSTRAINT "clinical_surgery_details_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_surgery_details" ADD CONSTRAINT "clinical_surgery_details_clinical_procedure_id_organizatio_fkey" FOREIGN KEY ("clinical_procedure_id", "organization_id") REFERENCES "clinical_procedures"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_surgery_details" ADD CONSTRAINT "clinical_surgery_details_assistant_membership_id_organizat_fkey" FOREIGN KEY ("assistant_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
