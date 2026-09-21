-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOIDED');

-- AlterEnum
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'PRESCRIPTION_CREATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'PRESCRIPTION_UPDATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'PRESCRIPTION_FINALIZED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'PRESCRIPTION_VOIDED';

-- AlterEnum
ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'PRESCRIPTION';

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinical_encounter_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "prescribed_by_membership_id" UUID,
    "created_by_membership_id" UUID NOT NULL,
    "professional_display_name_snapshot" TEXT,
    "professional_license_snapshot" TEXT,
    "patient_name_snapshot" TEXT,
    "owner_display_name_snapshot" TEXT,
    "diagnosis_snapshot" TEXT,
    "finalized_at" TIMESTAMPTZ(3),
    "finalized_by_membership_id" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "medication_name" TEXT NOT NULL,
    "presentation" TEXT,
    "quantity" TEXT,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescriptions_organization_id_patient_id_created_at_idx" ON "prescriptions"("organization_id", "patient_id", "created_at");
CREATE INDEX "prescriptions_organization_id_clinical_encounter_id_idx" ON "prescriptions"("organization_id", "clinical_encounter_id");
CREATE INDEX "prescriptions_organization_id_status_idx" ON "prescriptions"("organization_id", "status");
CREATE INDEX "prescriptions_organization_id_prescribed_by_membership_id_idx" ON "prescriptions"("organization_id", "prescribed_by_membership_id");
CREATE UNIQUE INDEX "prescriptions_id_organization_id_key" ON "prescriptions"("id", "organization_id");
CREATE INDEX "prescription_items_prescription_id_position_idx" ON "prescription_items"("prescription_id", "position");
CREATE UNIQUE INDEX "prescription_items_prescription_position_key" ON "prescription_items"("prescription_id", "position");
CREATE UNIQUE INDEX "clinical_encounters_id_org_patient_key" ON "clinical_encounters"("id", "organization_id", "patient_id");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinical_encounter_id_organization_id_patien_fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id") REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_prescribed_by_membership_id_organization_id_fkey" FOREIGN KEY ("prescribed_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_finalized_by_membership_id_organization_id_fkey" FOREIGN KEY ("finalized_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
