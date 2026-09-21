-- Preserve the explicit one-profile and organization/patient uniqueness contracts.
CREATE UNIQUE INDEX IF NOT EXISTS "membership_professional_profiles_membership_id_key"
  ON "membership_professional_profiles"("membership_id");

CREATE UNIQUE INDEX IF NOT EXISTS "clinical_records_organization_patient_key"
  ON "clinical_records"("organization_id", "patient_id");
