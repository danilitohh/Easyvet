-- Keep terminal prescription evidence coherent even for trusted SQL writers.
ALTER TABLE "prescriptions"
  ADD CONSTRAINT "prescriptions_version_positive_check"
    CHECK ("version" > 0),
  ADD CONSTRAINT "prescriptions_lifecycle_metadata_check"
    CHECK (
      (
        "status" = 'DRAFT'::"PrescriptionStatus"
        AND "finalized_at" IS NULL
        AND "finalized_by_membership_id" IS NULL
        AND "voided_at" IS NULL
        AND "voided_by_membership_id" IS NULL
        AND "void_reason" IS NULL
      )
      OR (
        "status" = 'FINALIZED'::"PrescriptionStatus"
        AND "finalized_at" IS NOT NULL
        AND "finalized_by_membership_id" IS NOT NULL
        AND length(btrim("professional_display_name_snapshot")) > 0
        AND length(btrim("patient_name_snapshot")) > 0
        AND length(btrim("owner_display_name_snapshot")) > 0
        AND "voided_at" IS NULL
        AND "voided_by_membership_id" IS NULL
        AND "void_reason" IS NULL
      )
      OR (
        "status" = 'VOIDED'::"PrescriptionStatus"
        AND "finalized_at" IS NOT NULL
        AND "finalized_by_membership_id" IS NOT NULL
        AND length(btrim("professional_display_name_snapshot")) > 0
        AND length(btrim("patient_name_snapshot")) > 0
        AND length(btrim("owner_display_name_snapshot")) > 0
        AND "voided_at" IS NOT NULL
        AND "voided_by_membership_id" IS NOT NULL
        AND length(btrim("void_reason")) > 0
      )
    );
