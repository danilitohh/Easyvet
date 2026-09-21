-- Align the additive clinical foundation with the approved field vocabulary.
ALTER TABLE "clinical_encounters"
  RENAME COLUMN "diagnosis" TO "presumptive_diagnosis";

ALTER TABLE "clinical_encounters"
  RENAME COLUMN "diagnosis_notes" TO "differential_diagnosis";

ALTER TABLE "clinical_encounters"
  ADD COLUMN "definitive_diagnosis" TEXT,
  ADD COLUMN "diagnostic_plan" TEXT;

ALTER TABLE "clinical_encounters"
  RENAME COLUMN "plan" TO "therapeutic_plan";

ALTER TABLE "clinical_encounters"
  RENAME COLUMN "professional_display_name" TO "professional_display_name_snapshot";

ALTER TABLE "clinical_encounters"
  RENAME COLUMN "professional_license_number" TO "professional_license_snapshot";

ALTER TABLE "vital_measurements"
  RENAME COLUMN "weight" TO "weight_kg";

ALTER TABLE "vital_measurements"
  RENAME COLUMN "temperature" TO "temperature_c";

ALTER TABLE "vital_measurements"
  RENAME COLUMN "heart_rate" TO "heart_rate_bpm";

ALTER TABLE "vital_measurements"
  RENAME COLUMN "respiratory_rate" TO "respiratory_rate_bpm";
