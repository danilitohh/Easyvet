-- CreateEnum
CREATE TYPE "ClinicalRole" AS ENUM ('PRACTITIONER', 'CLINICAL_ASSISTANT');

-- CreateEnum
CREATE TYPE "ClinicalEncounterStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ClinicalAuditEntityType" AS ENUM ('CLINICAL_RECORD', 'CLINICAL_ENCOUNTER', 'CLINICAL_EVOLUTION', 'VITAL_MEASUREMENT');

-- CreateEnum
CREATE TYPE "ClinicalAuditAction" AS ENUM ('CREATED', 'UPDATED', 'FINALIZED', 'VOIDED', 'EVOLUTION_ADDED', 'VITAL_ADDED');

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "clinical_role" "ClinicalRole";

-- CreateTable
CREATE TABLE "membership_professional_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "license_number" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "membership_professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_encounters" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinical_record_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "owner_id_at_time" UUID NOT NULL,
    "clinic_location_id" UUID NOT NULL,
    "appointment_id" UUID,
    "responsible_membership_id" UUID,
    "status" "ClinicalEncounterStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "anamnesis" TEXT,
    "physical_exam" TEXT,
    "diagnosis" TEXT,
    "diagnosis_notes" TEXT,
    "plan" TEXT,
    "recommendations" TEXT,
    "follow_up_plan" TEXT,
    "notes" TEXT,
    "professional_display_name" TEXT,
    "professional_license_number" TEXT,
    "finalized_at" TIMESTAMPTZ(3),
    "finalized_by_membership_id" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "void_reason" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_evolutions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinical_record_id" UUID NOT NULL,
    "clinical_encounter_id" UUID,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "author_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_measurements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinical_record_id" UUID NOT NULL,
    "clinical_encounter_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "measured_at" TIMESTAMPTZ(3) NOT NULL,
    "weight" DECIMAL(20,6),
    "temperature" DECIMAL(20,6),
    "heart_rate" INTEGER,
    "respiratory_rate" INTEGER,
    "body_condition" TEXT,
    "hydration" TEXT,
    "mucous_membranes" TEXT,
    "skin_turgor" TEXT,
    "observations" TEXT,
    "recorded_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vital_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_membership_id" UUID,
    "entity_type" "ClinicalAuditEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "ClinicalAuditAction" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membership_professional_profiles_membership_id_key" ON "membership_professional_profiles"("membership_id");

-- CreateIndex
CREATE INDEX "membership_professional_profiles_organization_id_idx" ON "membership_professional_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_professional_profiles_id_organization_id_key" ON "membership_professional_profiles"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_professional_profiles_membership_org_key" ON "membership_professional_profiles"("membership_id", "organization_id");

-- CreateIndex
CREATE INDEX "clinical_records_organization_id_patient_id_idx" ON "clinical_records"("organization_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_records_organization_patient_key" ON "clinical_records"("organization_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_records_patient_organization_key" ON "clinical_records"("patient_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_records_id_organization_id_key" ON "clinical_records"("id", "organization_id");

-- CreateIndex
-- CreateIndex
CREATE INDEX "clinical_encounters_organization_id_patient_id_occurred_at_idx" ON "clinical_encounters"("organization_id", "patient_id", "occurred_at");

-- CreateIndex
CREATE INDEX "clinical_encounters_organization_id_clinical_record_id_occu_idx" ON "clinical_encounters"("organization_id", "clinical_record_id", "occurred_at");

-- CreateIndex
CREATE INDEX "clinical_encounters_organization_id_responsible_membership__idx" ON "clinical_encounters"("organization_id", "responsible_membership_id", "occurred_at");

-- CreateIndex
CREATE INDEX "clinical_encounters_organization_id_status_idx" ON "clinical_encounters"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_encounters_id_organization_id_key" ON "clinical_encounters"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_encounters_id_org_record_key" ON "clinical_encounters"("id", "organization_id", "clinical_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_encounters_appointment_org_key" ON "clinical_encounters"("appointment_id", "organization_id");

-- CreateIndex
CREATE INDEX "clinical_evolutions_organization_id_clinical_record_id_occu_idx" ON "clinical_evolutions"("organization_id", "clinical_record_id", "occurred_at");

-- CreateIndex
CREATE INDEX "clinical_evolutions_organization_id_clinical_encounter_id_o_idx" ON "clinical_evolutions"("organization_id", "clinical_encounter_id", "occurred_at");

-- CreateIndex
CREATE INDEX "vital_measurements_organization_id_patient_id_measured_at_idx" ON "vital_measurements"("organization_id", "patient_id", "measured_at");

-- CreateIndex
CREATE INDEX "vital_measurements_organization_id_clinical_record_id_measu_idx" ON "vital_measurements"("organization_id", "clinical_record_id", "measured_at");

-- CreateIndex
CREATE INDEX "vital_measurements_organization_id_clinical_encounter_id_me_idx" ON "vital_measurements"("organization_id", "clinical_encounter_id", "measured_at");

-- CreateIndex
CREATE INDEX "clinical_audit_events_organization_id_entity_type_entity_id_idx" ON "clinical_audit_events"("organization_id", "entity_type", "entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "membership_professional_profiles" ADD CONSTRAINT "membership_professional_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_professional_profiles" ADD CONSTRAINT "membership_professional_profiles_membership_id_organizatio_fkey" FOREIGN KEY ("membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_clinical_record_id_organization_id_fkey" FOREIGN KEY ("clinical_record_id", "organization_id") REFERENCES "clinical_records"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_owner_id_at_time_organization_id_fkey" FOREIGN KEY ("owner_id_at_time", "organization_id") REFERENCES "owners"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_clinic_location_id_organization_id_fkey" FOREIGN KEY ("clinic_location_id", "organization_id") REFERENCES "clinic_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_appointment_id_organization_id_fkey" FOREIGN KEY ("appointment_id", "organization_id") REFERENCES "appointments"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_responsible_membership_id_organization_fkey" FOREIGN KEY ("responsible_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_finalized_by_membership_id_organizatio_fkey" FOREIGN KEY ("finalized_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_voided_by_membership_id_organization_i_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_created_by_membership_id_organization__fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_clinical_record_id_organization_id_fkey" FOREIGN KEY ("clinical_record_id", "organization_id") REFERENCES "clinical_records"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_clinical_encounter_id_organization_id__fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "clinical_record_id") REFERENCES "clinical_encounters"("id", "organization_id", "clinical_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_author_membership_id_organization_id_fkey" FOREIGN KEY ("author_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_measurements" ADD CONSTRAINT "vital_measurements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_measurements" ADD CONSTRAINT "vital_measurements_clinical_record_id_organization_id_fkey" FOREIGN KEY ("clinical_record_id", "organization_id") REFERENCES "clinical_records"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_measurements" ADD CONSTRAINT "vital_measurements_clinical_encounter_id_organization_id_c_fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "clinical_record_id") REFERENCES "clinical_encounters"("id", "organization_id", "clinical_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_measurements" ADD CONSTRAINT "vital_measurements_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_measurements" ADD CONSTRAINT "vital_measurements_recorded_by_membership_id_organization__fkey" FOREIGN KEY ("recorded_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_audit_events" ADD CONSTRAINT "clinical_audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_audit_events" ADD CONSTRAINT "clinical_audit_events_actor_membership_id_organization_id_fkey" FOREIGN KEY ("actor_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database invariants keep encounter state and immutable measurement values coherent.
ALTER TABLE "clinical_encounters"
  ADD CONSTRAINT "clinical_encounters_version_positive_check" CHECK ("version" > 0),
  ADD CONSTRAINT "clinical_encounters_status_timestamps_check" CHECK (
    ("status" = 'DRAFT' AND "finalized_at" IS NULL AND "finalized_by_membership_id" IS NULL AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL)
    OR ("status" = 'FINALIZED' AND "finalized_at" IS NOT NULL AND "finalized_by_membership_id" IS NOT NULL AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL)
    OR ("status" = 'VOIDED' AND "finalized_at" IS NOT NULL AND "finalized_by_membership_id" IS NOT NULL AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL AND "void_reason" IS NOT NULL AND btrim("void_reason") <> '')
  );

ALTER TABLE "vital_measurements"
  ADD CONSTRAINT "vital_measurements_weight_positive_check" CHECK ("weight" IS NULL OR "weight" > 0),
  ADD CONSTRAINT "vital_measurements_heart_rate_positive_check" CHECK ("heart_rate" IS NULL OR "heart_rate" > 0),
  ADD CONSTRAINT "vital_measurements_respiratory_rate_positive_check" CHECK ("respiratory_rate" IS NULL OR "respiratory_rate" > 0);
