-- Fase 6H: one tenant-safe aggregate stores diagnostic requests and their results.
CREATE TYPE "DiagnosticCategory" AS ENUM ('LABORATORY', 'IMAGING', 'PATHOLOGY', 'OTHER');
CREATE TYPE "DiagnosticOrderStatus" AS ENUM ('DRAFT', 'REQUESTED', 'RESULTED', 'VOIDED');

ALTER TYPE "ClinicalAuditEntityType" ADD VALUE 'DIAGNOSTIC_ORDER';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'DIAGNOSTIC_ORDER_CREATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'DIAGNOSTIC_ORDER_UPDATED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'DIAGNOSTIC_ORDER_REQUESTED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'DIAGNOSTIC_ORDER_RESULTED';
ALTER TYPE "ClinicalAuditAction" ADD VALUE 'DIAGNOSTIC_ORDER_VOIDED';

CREATE TABLE "diagnostic_orders" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "clinical_encounter_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "category" "DiagnosticCategory" NOT NULL,
  "status" "DiagnosticOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "test_name" VARCHAR(300),
  "requested_at" TIMESTAMPTZ(3),
  "reason" VARCHAR(5000),
  "instructions" VARCHAR(10000),
  "notes" VARCHAR(10000),
  "responsible_practitioner_membership_id" UUID,
  "created_by_membership_id" UUID NOT NULL,
  "patient_name_snapshot" VARCHAR(200),
  "owner_display_name_snapshot" VARCHAR(300),
  "professional_display_name_snapshot" VARCHAR(200),
  "professional_license_snapshot" VARCHAR(160),
  "requested_by_membership_id" UUID,
  "resulted_at" TIMESTAMPTZ(3),
  "result_text" VARCHAR(20000),
  "interpretation" VARCHAR(10000),
  "resulted_by_membership_id" UUID,
  "voided_at" TIMESTAMPTZ(3),
  "voided_by_membership_id" UUID,
  "void_reason" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "diagnostic_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "diagnostic_orders_version_positive_check" CHECK ("version" >= 1),
  CONSTRAINT "diagnostic_orders_result_metadata_check" CHECK (
    ("resulted_at" IS NULL AND "resulted_by_membership_id" IS NULL
      AND "result_text" IS NULL AND "interpretation" IS NULL)
    OR ("resulted_at" IS NOT NULL AND "resulted_by_membership_id" IS NOT NULL
      AND (length(btrim(coalesce("result_text", ''))) > 0
        OR length(btrim(coalesce("interpretation", ''))) > 0))
  ),
  CONSTRAINT "diagnostic_orders_void_metadata_check" CHECK (
    ("voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL)
    OR ("voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL
      AND length(btrim(coalesce("void_reason", ''))) > 0)
  ),
  CONSTRAINT "diagnostic_orders_lifecycle_check" CHECK (
    (
      "status" = 'DRAFT'
      AND "requested_by_membership_id" IS NULL
      AND "patient_name_snapshot" IS NULL
      AND "owner_display_name_snapshot" IS NULL
      AND "professional_display_name_snapshot" IS NULL
      AND "professional_license_snapshot" IS NULL
      AND "resulted_at" IS NULL AND "resulted_by_membership_id" IS NULL
      AND "result_text" IS NULL AND "interpretation" IS NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
    ) OR (
      "status" = 'REQUESTED'
      AND "requested_at" IS NOT NULL
      AND length(btrim(coalesce("test_name", ''))) > 0
      AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "requested_by_membership_id" IS NOT NULL
      AND length(btrim(coalesce("patient_name_snapshot", ''))) > 0
      AND length(btrim(coalesce("owner_display_name_snapshot", ''))) > 0
      AND length(btrim(coalesce("professional_display_name_snapshot", ''))) > 0
      AND "resulted_at" IS NULL AND "resulted_by_membership_id" IS NULL
      AND "result_text" IS NULL AND "interpretation" IS NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
    ) OR (
      "status" = 'RESULTED'
      AND "requested_at" IS NOT NULL
      AND length(btrim(coalesce("test_name", ''))) > 0
      AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "requested_by_membership_id" IS NOT NULL
      AND length(btrim(coalesce("patient_name_snapshot", ''))) > 0
      AND length(btrim(coalesce("owner_display_name_snapshot", ''))) > 0
      AND length(btrim(coalesce("professional_display_name_snapshot", ''))) > 0
      AND "resulted_at" IS NOT NULL AND "resulted_by_membership_id" IS NOT NULL
      AND (length(btrim(coalesce("result_text", ''))) > 0
        OR length(btrim(coalesce("interpretation", ''))) > 0)
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
    ) OR (
      "status" = 'VOIDED'
      AND "requested_at" IS NOT NULL
      AND length(btrim(coalesce("test_name", ''))) > 0
      AND "responsible_practitioner_membership_id" IS NOT NULL
      AND "requested_by_membership_id" IS NOT NULL
      AND length(btrim(coalesce("patient_name_snapshot", ''))) > 0
      AND length(btrim(coalesce("owner_display_name_snapshot", ''))) > 0
      AND length(btrim(coalesce("professional_display_name_snapshot", ''))) > 0
      AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL
      AND length(btrim(coalesce("void_reason", ''))) > 0
    )
  ),
  CONSTRAINT "diagnostic_orders_id_organization_id_key" UNIQUE ("id", "organization_id"),
  CONSTRAINT "diagnostic_orders_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "diagnostic_orders_encounter_org_patient_fkey" FOREIGN KEY ("clinical_encounter_id", "organization_id", "patient_id")
    REFERENCES "clinical_encounters"("id", "organization_id", "patient_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "diagnostic_orders_patient_org_fkey" FOREIGN KEY ("patient_id", "organization_id")
    REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "diagnostic_orders_created_by_membership_org_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id")
    REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "diagnostic_orders_responsible_membership_org_fkey" FOREIGN KEY ("responsible_practitioner_membership_id", "organization_id")
    REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "diagnostic_orders_requested_by_membership_org_fkey" FOREIGN KEY ("requested_by_membership_id", "organization_id")
    REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "diagnostic_orders_resulted_by_membership_org_fkey" FOREIGN KEY ("resulted_by_membership_id", "organization_id")
    REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "diagnostic_orders_voided_by_membership_org_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id")
    REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "diagnostic_orders_org_patient_requested_created_idx"
  ON "diagnostic_orders"("organization_id", "patient_id", "requested_at" DESC NULLS LAST, "created_at" DESC, "id" ASC);
CREATE INDEX "diagnostic_orders_org_encounter_requested_idx"
  ON "diagnostic_orders"("organization_id", "clinical_encounter_id", "requested_at" DESC NULLS LAST);
CREATE INDEX "diagnostic_orders_org_status_requested_idx"
  ON "diagnostic_orders"("organization_id", "status", "requested_at" DESC NULLS LAST);
CREATE INDEX "diagnostic_orders_org_category_requested_idx"
  ON "diagnostic_orders"("organization_id", "category", "requested_at" DESC NULLS LAST);
