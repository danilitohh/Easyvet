-- Fase 6G: tenant-safe hospitalization aggregate and immutable Kardex entries.
CREATE TYPE "HospitalizationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISCHARGED', 'VOIDED');
CREATE TYPE "HospitalizationEntryType" AS ENUM ('EVOLUTION', 'MONITORING', 'MEDICATION', 'NURSING', 'DIET', 'OTHER');

ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'HOSPITALIZATION';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'HOSPITALIZATION_CREATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'HOSPITALIZATION_UPDATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'HOSPITALIZATION_ACTIVATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'HOSPITALIZATION_ENTRY_ADDED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'HOSPITALIZATION_DISCHARGED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'HOSPITALIZATION_VOIDED';

CREATE TABLE "hospitalizations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "clinical_encounter_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "status" "HospitalizationStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "admitted_at" TIMESTAMPTZ(3),
  "discharged_at" TIMESTAMPTZ(3),
  "location_name" VARCHAR(160),
  "admission_reason" VARCHAR(5000),
  "diagnosis" VARCHAR(10000),
  "treatment_plan" VARCHAR(10000),
  "medications_text" VARCHAR(10000),
  "diet_instructions" VARCHAR(5000),
  "discharge_summary" VARCHAR(10000),
  "discharge_recommendations" VARCHAR(10000),
  "notes" VARCHAR(10000),
  "responsible_practitioner_membership_id" UUID,
  "created_by_membership_id" UUID NOT NULL,
  "patient_name_snapshot" VARCHAR(200),
  "owner_display_name_snapshot" VARCHAR(300),
  "professional_display_name_snapshot" VARCHAR(200),
  "professional_license_snapshot" VARCHAR(120),
  "activated_at" TIMESTAMPTZ(3),
  "activated_by_membership_id" UUID,
  "discharged_by_membership_id" UUID,
  "voided_at" TIMESTAMPTZ(3),
  "voided_by_membership_id" UUID,
  "void_reason" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "hospitalizations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hospitalizations_version_positive_check" CHECK ("version" >= 1),
  CONSTRAINT "hospitalizations_discharge_time_order_check" CHECK (
    "discharged_at" IS NULL OR ("admitted_at" IS NOT NULL AND "discharged_at" >= "admitted_at")
  ),
  CONSTRAINT "hospitalizations_discharge_actor_pair_check" CHECK (
    ("discharged_at" IS NULL AND "discharged_by_membership_id" IS NULL)
    OR ("discharged_at" IS NOT NULL AND "discharged_by_membership_id" IS NOT NULL)
  ),
  CONSTRAINT "hospitalizations_lifecycle_metadata_check" CHECK (
    (
      "status" = 'DRAFT' AND "activated_at" IS NULL AND "activated_by_membership_id" IS NULL
      AND "discharged_at" IS NULL AND "discharged_by_membership_id" IS NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NULL AND "owner_display_name_snapshot" IS NULL
      AND "professional_display_name_snapshot" IS NULL AND "professional_license_snapshot" IS NULL
    ) OR (
      "status" = 'ACTIVE' AND "admitted_at" IS NOT NULL AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "activated_at" IS NOT NULL AND "activated_by_membership_id" IS NOT NULL
      AND "discharged_at" IS NULL AND "discharged_by_membership_id" IS NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NOT NULL AND "owner_display_name_snapshot" IS NOT NULL
      AND "professional_display_name_snapshot" IS NOT NULL
    ) OR (
      "status" = 'DISCHARGED' AND "admitted_at" IS NOT NULL AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "activated_at" IS NOT NULL AND "activated_by_membership_id" IS NOT NULL
      AND "discharged_at" IS NOT NULL AND "discharged_by_membership_id" IS NOT NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "patient_name_snapshot" IS NOT NULL AND "owner_display_name_snapshot" IS NOT NULL
      AND "professional_display_name_snapshot" IS NOT NULL
    ) OR (
      "status" = 'VOIDED' AND "admitted_at" IS NOT NULL AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "activated_at" IS NOT NULL AND "activated_by_membership_id" IS NOT NULL
      AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL
      AND "void_reason" IS NOT NULL AND length(btrim("void_reason")) > 0
      AND "patient_name_snapshot" IS NOT NULL AND "owner_display_name_snapshot" IS NOT NULL
      AND "professional_display_name_snapshot" IS NOT NULL
    )
  ),
  CONSTRAINT "hospitalizations_id_organization_id_key" UNIQUE ("id", "organization_id"),
  CONSTRAINT "hospitalizations_encounter_org_key" UNIQUE ("clinical_encounter_id", "organization_id"),
  CONSTRAINT "hospitalizations_encounter_org_patient_key" UNIQUE ("clinical_encounter_id", "organization_id", "patient_id"),
  CONSTRAINT "hospitalizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalizations_encounter_org_patient_fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id") REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalizations_patient_org_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalizations_created_by_membership_org_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalizations_responsible_membership_org_fkey" FOREIGN KEY ("responsible_practitioner_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalizations_activated_by_membership_org_fkey" FOREIGN KEY ("activated_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalizations_discharged_by_membership_org_fkey" FOREIGN KEY ("discharged_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalizations_voided_by_membership_org_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "hospitalizations_org_patient_admitted_created_idx"
  ON "hospitalizations"("organization_id", "patient_id", "admitted_at" DESC NULLS LAST, "created_at" DESC, "id" ASC);
CREATE INDEX "hospitalizations_org_status_idx" ON "hospitalizations"("organization_id", "status");

CREATE TABLE "hospitalization_entries" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "hospitalization_id" UUID NOT NULL,
  "entry_type" "HospitalizationEntryType" NOT NULL,
  "recorded_at" TIMESTAMPTZ(3) NOT NULL,
  "content" VARCHAR(10000),
  "temperature_c" DECIMAL(20,6),
  "heart_rate_bpm" INTEGER,
  "respiratory_rate_per_minute" INTEGER,
  "weight_kg" DECIMAL(20,6),
  "recorded_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hospitalization_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hospitalization_entries_nonempty_check" CHECK (
    length(btrim(coalesce("content", ''))) > 0 OR "temperature_c" IS NOT NULL
    OR "heart_rate_bpm" IS NOT NULL OR "respiratory_rate_per_minute" IS NOT NULL OR "weight_kg" IS NOT NULL
  ),
  CONSTRAINT "hospitalization_entries_temperature_positive_check" CHECK ("temperature_c" IS NULL OR "temperature_c" > 0),
  CONSTRAINT "hospitalization_entries_heart_rate_nonnegative_check" CHECK ("heart_rate_bpm" IS NULL OR "heart_rate_bpm" >= 0),
  CONSTRAINT "hospitalization_entries_respiratory_rate_nonnegative_check" CHECK ("respiratory_rate_per_minute" IS NULL OR "respiratory_rate_per_minute" >= 0),
  CONSTRAINT "hospitalization_entries_weight_positive_check" CHECK ("weight_kg" IS NULL OR "weight_kg" > 0),
  CONSTRAINT "hospitalization_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalization_entries_episode_org_fkey" FOREIGN KEY ("hospitalization_id", "organization_id") REFERENCES "hospitalizations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hospitalization_entries_recorded_by_membership_org_fkey" FOREIGN KEY ("recorded_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "hospitalization_entries_org_episode_time_idx"
  ON "hospitalization_entries"("organization_id", "hospitalization_id", "recorded_at" ASC, "created_at" ASC, "id" ASC);
