-- Keep only the tenant-safe unique indexes required by the clinical relations.
DROP INDEX IF EXISTS "membership_professional_profiles_membership_id_key";
DROP INDEX IF EXISTS "clinical_records_organization_id_patient_id_idx";
DROP INDEX IF EXISTS "clinical_records_organization_patient_key";
