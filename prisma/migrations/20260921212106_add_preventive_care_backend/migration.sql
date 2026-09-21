-- CreateEnum
CREATE TYPE "PreventiveRecordStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'VACCINATION';
ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'DEWORMING';

-- CreateTable
CREATE TABLE "vaccinations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinical_encounter_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "PreventiveRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "administered_on" DATE,
    "next_due_on" DATE,
    "vaccine_name" VARCHAR(200),
    "vaccine_type" VARCHAR(120),
    "route" VARCHAR(100),
    "laboratory_name" VARCHAR(160),
    "lot_number" VARCHAR(120),
    "expiry_on" DATE,
    "dose_text" VARCHAR(500),
    "notes" VARCHAR(5000),
    "created_by_membership_id" UUID NOT NULL,
    "responsible_practitioner_membership_id" UUID,
    "administered_by_membership_id" UUID,
    "patient_name_snapshot" VARCHAR(200),
    "owner_display_name_snapshot" VARCHAR(200),
    "professional_display_name_snapshot" VARCHAR(200),
    "professional_license_snapshot" VARCHAR(160),
    "administered_by_display_name_snapshot" VARCHAR(200),
    "finalized_at" TIMESTAMPTZ(3),
    "finalized_by_membership_id" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "void_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dewormings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinical_encounter_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "PreventiveRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "administered_on" DATE,
    "next_due_on" DATE,
    "product_name" VARCHAR(200),
    "deworming_type" VARCHAR(120),
    "dose_text" VARCHAR(500),
    "notes" VARCHAR(5000),
    "created_by_membership_id" UUID NOT NULL,
    "responsible_practitioner_membership_id" UUID,
    "administered_by_membership_id" UUID,
    "patient_name_snapshot" VARCHAR(200),
    "owner_display_name_snapshot" VARCHAR(200),
    "professional_display_name_snapshot" VARCHAR(200),
    "professional_license_snapshot" VARCHAR(160),
    "administered_by_display_name_snapshot" VARCHAR(200),
    "finalized_at" TIMESTAMPTZ(3),
    "finalized_by_membership_id" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "void_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dewormings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vaccinations_organization_id_patient_id_administered_on_cre_idx" ON "vaccinations"("organization_id", "patient_id", "administered_on", "created_at");

-- CreateIndex
CREATE INDEX "vaccinations_organization_id_clinical_encounter_id_idx" ON "vaccinations"("organization_id", "clinical_encounter_id");

-- CreateIndex
CREATE INDEX "vaccinations_organization_id_status_idx" ON "vaccinations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "vaccinations_organization_id_responsible_practitioner_membe_idx" ON "vaccinations"("organization_id", "responsible_practitioner_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "vaccinations_id_organization_id_key" ON "vaccinations"("id", "organization_id");

-- CreateIndex
CREATE INDEX "dewormings_organization_id_patient_id_administered_on_creat_idx" ON "dewormings"("organization_id", "patient_id", "administered_on", "created_at");

-- CreateIndex
CREATE INDEX "dewormings_organization_id_clinical_encounter_id_idx" ON "dewormings"("organization_id", "clinical_encounter_id");

-- CreateIndex
CREATE INDEX "dewormings_organization_id_status_idx" ON "dewormings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "dewormings_organization_id_responsible_practitioner_members_idx" ON "dewormings"("organization_id", "responsible_practitioner_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "dewormings_id_organization_id_key" ON "dewormings"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_clinical_encounter_id_organization_id_patient_fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id") REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_responsible_practitioner_membership_id_organi_fkey" FOREIGN KEY ("responsible_practitioner_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_administered_by_membership_id_organization_id_fkey" FOREIGN KEY ("administered_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_finalized_by_membership_id_organization_id_fkey" FOREIGN KEY ("finalized_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_clinical_encounter_id_organization_id_patient_i_fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id") REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_responsible_practitioner_membership_id_organiza_fkey" FOREIGN KEY ("responsible_practitioner_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_administered_by_membership_id_organization_id_fkey" FOREIGN KEY ("administered_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_finalized_by_membership_id_organization_id_fkey" FOREIGN KEY ("finalized_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lifecycle, civil-date and snapshot checks are explicit PostgreSQL invariants.
ALTER TABLE "vaccinations"
  ADD CONSTRAINT "vaccinations_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "vaccinations_next_due_on_check" CHECK ("next_due_on" IS NULL OR "administered_on" IS NULL OR "next_due_on" >= "administered_on"),
  ADD CONSTRAINT "vaccinations_draft_metadata_check" CHECK (
    "status" <> 'DRAFT'::"PreventiveRecordStatus"
    OR ("finalized_at" IS NULL AND "finalized_by_membership_id" IS NULL AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NULL AND "owner_display_name_snapshot" IS NULL
      AND "professional_display_name_snapshot" IS NULL AND "professional_license_snapshot" IS NULL
      AND "administered_by_display_name_snapshot" IS NULL)
  ),
  ADD CONSTRAINT "vaccinations_finalized_requirements_check" CHECK (
    "status" NOT IN ('FINALIZED'::"PreventiveRecordStatus", 'VOIDED'::"PreventiveRecordStatus")
    OR ("finalized_at" IS NOT NULL AND "finalized_by_membership_id" IS NOT NULL AND "administered_on" IS NOT NULL
      AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "vaccine_name" IS NOT NULL AND btrim("vaccine_name") <> ''
      AND "professional_display_name_snapshot" IS NOT NULL AND btrim("professional_display_name_snapshot") <> ''
      AND "patient_name_snapshot" IS NOT NULL AND btrim("patient_name_snapshot") <> ''
      AND "owner_display_name_snapshot" IS NOT NULL AND btrim("owner_display_name_snapshot") <> '')
  ),
  ADD CONSTRAINT "vaccinations_finalized_void_metadata_check" CHECK (
    ("status" = 'FINALIZED'::"PreventiveRecordStatus" AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL)
    OR ("status" = 'VOIDED'::"PreventiveRecordStatus" AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL AND "void_reason" IS NOT NULL AND btrim("void_reason") <> '')
    OR "status" = 'DRAFT'::"PreventiveRecordStatus"
  ),
  ADD CONSTRAINT "vaccinations_administered_snapshot_check" CHECK (
    "status" = 'DRAFT'::"PreventiveRecordStatus"
    OR (("administered_by_membership_id" IS NULL AND "administered_by_display_name_snapshot" IS NULL)
      OR ("administered_by_membership_id" IS NOT NULL AND "administered_by_display_name_snapshot" IS NOT NULL AND btrim("administered_by_display_name_snapshot") <> ''))
  );

ALTER TABLE "dewormings"
  ADD CONSTRAINT "dewormings_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "dewormings_next_due_on_check" CHECK ("next_due_on" IS NULL OR "administered_on" IS NULL OR "next_due_on" >= "administered_on"),
  ADD CONSTRAINT "dewormings_draft_metadata_check" CHECK (
    "status" <> 'DRAFT'::"PreventiveRecordStatus"
    OR ("finalized_at" IS NULL AND "finalized_by_membership_id" IS NULL AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NULL AND "owner_display_name_snapshot" IS NULL
      AND "professional_display_name_snapshot" IS NULL AND "professional_license_snapshot" IS NULL
      AND "administered_by_display_name_snapshot" IS NULL)
  ),
  ADD CONSTRAINT "dewormings_finalized_requirements_check" CHECK (
    "status" NOT IN ('FINALIZED'::"PreventiveRecordStatus", 'VOIDED'::"PreventiveRecordStatus")
    OR ("finalized_at" IS NOT NULL AND "finalized_by_membership_id" IS NOT NULL AND "administered_on" IS NOT NULL
      AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "product_name" IS NOT NULL AND btrim("product_name") <> ''
      AND "professional_display_name_snapshot" IS NOT NULL AND btrim("professional_display_name_snapshot") <> ''
      AND "patient_name_snapshot" IS NOT NULL AND btrim("patient_name_snapshot") <> ''
      AND "owner_display_name_snapshot" IS NOT NULL AND btrim("owner_display_name_snapshot") <> '')
  ),
  ADD CONSTRAINT "dewormings_finalized_void_metadata_check" CHECK (
    ("status" = 'FINALIZED'::"PreventiveRecordStatus" AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL)
    OR ("status" = 'VOIDED'::"PreventiveRecordStatus" AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL AND "void_reason" IS NOT NULL AND btrim("void_reason") <> '')
    OR "status" = 'DRAFT'::"PreventiveRecordStatus"
  ),
  ADD CONSTRAINT "dewormings_administered_snapshot_check" CHECK (
    "status" = 'DRAFT'::"PreventiveRecordStatus"
    OR (("administered_by_membership_id" IS NULL AND "administered_by_display_name_snapshot" IS NULL)
      OR ("administered_by_membership_id" IS NOT NULL AND "administered_by_display_name_snapshot" IS NOT NULL AND btrim("administered_by_display_name_snapshot") <> ''))
  );
