-- Fase 6F.2B: independent anesthesia aggregate and mutable draft monitoring rows.
CREATE TYPE "AnesthesiaRecordStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOIDED');

ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'ANESTHESIA_RECORD';

ALTER TABLE "clinical_procedures"
ADD CONSTRAINT "clinical_procedures_id_org_patient_encounter_key"
UNIQUE ("id", "organization_id", "patient_id", "clinical_encounter_id");

CREATE TABLE "anesthesia_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "clinical_encounter_id" UUID NOT NULL,
  "clinical_procedure_id" UUID,
  "patient_id" UUID NOT NULL,
  "status" "AnesthesiaRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "started_at" TIMESTAMPTZ(3),
  "ended_at" TIMESTAMPTZ(3),
  "asa_classification" VARCHAR(100),
  "technique" VARCHAR(10000),
  "pre_anesthetic_assessment" VARCHAR(10000),
  "medications_text" VARCHAR(10000),
  "airway_management" VARCHAR(5000),
  "fluids_text" VARCHAR(10000),
  "complications" VARCHAR(10000),
  "recovery_notes" VARCHAR(10000),
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
  CONSTRAINT "anesthesia_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anesthesia_records_version_positive_check" CHECK ("version" >= 1),
  CONSTRAINT "anesthesia_records_time_order_check" CHECK (
    "ended_at" IS NULL OR "started_at" IS NULL OR "ended_at" >= "started_at"
  ),
  CONSTRAINT "anesthesia_records_lifecycle_check" CHECK (
    (
      "status" = 'DRAFT'
      AND "finalized_at" IS NULL
      AND "finalized_by_membership_id" IS NULL
      AND "voided_at" IS NULL
      AND "voided_by_membership_id" IS NULL
      AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NULL
      AND "owner_display_name_snapshot" IS NULL
      AND "professional_display_name_snapshot" IS NULL
      AND "professional_license_snapshot" IS NULL
    )
    OR
    (
      "status" = 'FINALIZED'
      AND "started_at" IS NOT NULL
      AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "finalized_at" IS NOT NULL
      AND "finalized_by_membership_id" IS NOT NULL
      AND NULLIF(BTRIM("patient_name_snapshot"), '') IS NOT NULL
      AND NULLIF(BTRIM("owner_display_name_snapshot"), '') IS NOT NULL
      AND NULLIF(BTRIM("professional_display_name_snapshot"), '') IS NOT NULL
      AND "voided_at" IS NULL
      AND "voided_by_membership_id" IS NULL
      AND "void_reason" IS NULL
    )
    OR
    (
      "status" = 'VOIDED'
      AND "started_at" IS NOT NULL
      AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "finalized_at" IS NOT NULL
      AND "finalized_by_membership_id" IS NOT NULL
      AND NULLIF(BTRIM("patient_name_snapshot"), '') IS NOT NULL
      AND NULLIF(BTRIM("owner_display_name_snapshot"), '') IS NOT NULL
      AND NULLIF(BTRIM("professional_display_name_snapshot"), '') IS NOT NULL
      AND "voided_at" IS NOT NULL
      AND "voided_by_membership_id" IS NOT NULL
      AND NULLIF(BTRIM("void_reason"), '') IS NOT NULL
    )
  )
);

CREATE TABLE "anesthesia_observations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "anesthesia_record_id" UUID NOT NULL,
  "observed_at" TIMESTAMPTZ(3) NOT NULL,
  "heart_rate_bpm" INTEGER,
  "respiratory_rate_per_minute" INTEGER,
  "temperature_c" DECIMAL(5,2),
  "blood_pressure_text" VARCHAR(200),
  "spo2_percent" DECIMAL(5,2),
  "etco2_mm_hg" DECIMAL(8,2),
  "anesthetic_plane" VARCHAR(500),
  "notes" VARCHAR(5000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "anesthesia_observations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anesthesia_observations_numeric_values_check" CHECK (
    ("heart_rate_bpm" IS NULL OR "heart_rate_bpm" >= 0)
    AND ("respiratory_rate_per_minute" IS NULL OR "respiratory_rate_per_minute" >= 0)
    AND ("temperature_c" IS NULL OR "temperature_c" > 0)
    AND ("spo2_percent" IS NULL OR ("spo2_percent" >= 0 AND "spo2_percent" <= 100))
    AND ("etco2_mm_hg" IS NULL OR "etco2_mm_hg" >= 0)
  ),
  CONSTRAINT "anesthesia_observations_text_non_blank_check" CHECK (
    ("blood_pressure_text" IS NULL OR NULLIF(BTRIM("blood_pressure_text"), '') IS NOT NULL)
    AND ("anesthetic_plane" IS NULL OR NULLIF(BTRIM("anesthetic_plane"), '') IS NOT NULL)
    AND ("notes" IS NULL OR NULLIF(BTRIM("notes"), '') IS NOT NULL)
  ),
  CONSTRAINT "anesthesia_observations_non_empty_check" CHECK (
    "heart_rate_bpm" IS NOT NULL
    OR "respiratory_rate_per_minute" IS NOT NULL
    OR "temperature_c" IS NOT NULL
    OR NULLIF(BTRIM(COALESCE("blood_pressure_text", '')), '') IS NOT NULL
    OR "spo2_percent" IS NOT NULL
    OR "etco2_mm_hg" IS NOT NULL
    OR NULLIF(BTRIM(COALESCE("anesthetic_plane", '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE("notes", '')), '') IS NOT NULL
  )
);

CREATE UNIQUE INDEX "anesthesia_records_id_organization_id_key"
ON "anesthesia_records"("id", "organization_id");

CREATE INDEX "anesthesia_records_org_patient_started_created_idx"
ON "anesthesia_records"("organization_id", "patient_id", "started_at", "created_at");

CREATE INDEX "anesthesia_records_org_encounter_idx"
ON "anesthesia_records"("organization_id", "clinical_encounter_id");

CREATE INDEX "anesthesia_records_org_procedure_started_idx"
ON "anesthesia_records"("organization_id", "clinical_procedure_id", "started_at")
WHERE "clinical_procedure_id" IS NOT NULL;

CREATE INDEX "anesthesia_records_org_status_idx"
ON "anesthesia_records"("organization_id", "status");

CREATE INDEX "anesthesia_records_org_responsible_started_idx"
ON "anesthesia_records"("organization_id", "responsible_practitioner_membership_id", "started_at");

CREATE INDEX "anesthesia_observations_org_record_observed_created_id_idx"
ON "anesthesia_observations"("organization_id", "anesthesia_record_id", "observed_at", "created_at", "id");

ALTER TABLE "anesthesia_records"
ADD CONSTRAINT "anesthesia_records_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_records"
ADD CONSTRAINT "anesthesia_records_encounter_org_patient_fkey"
FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id")
REFERENCES "clinical_encounters"("id", "organization_id", "patient_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_records"
ADD CONSTRAINT "anesthesia_records_procedure_org_patient_encounter_fkey"
FOREIGN KEY ("clinical_procedure_id", "organization_id", "patient_id", "clinical_encounter_id")
REFERENCES "clinical_procedures"("id", "organization_id", "patient_id", "clinical_encounter_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_records"
ADD CONSTRAINT "anesthesia_records_patient_org_fkey"
FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_records"
ADD CONSTRAINT "anesthesia_records_created_by_membership_org_fkey"
FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_records"
ADD CONSTRAINT "anesthesia_records_responsible_membership_org_fkey"
FOREIGN KEY ("responsible_practitioner_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_records"
ADD CONSTRAINT "anesthesia_records_finalized_by_membership_org_fkey"
FOREIGN KEY ("finalized_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_records"
ADD CONSTRAINT "anesthesia_records_voided_by_membership_org_fkey"
FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_observations"
ADD CONSTRAINT "anesthesia_observations_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anesthesia_observations"
ADD CONSTRAINT "anesthesia_observations_record_org_fkey"
FOREIGN KEY ("anesthesia_record_id", "organization_id") REFERENCES "anesthesia_records"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
