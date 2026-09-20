-- Patient names are descriptive data; identity remains the Patient UUID.
DROP INDEX IF EXISTS "patients_org_owner_name_active_key";

-- Replace the previous species-specific weight cap with a positive-only invariant.
ALTER TABLE "patients"
DROP CONSTRAINT IF EXISTS "patients_current_weight_kg_check";

-- Preserve existing values while moving the snapshot to PostgreSQL NUMERIC.
ALTER TABLE "patients"
ALTER COLUMN "current_weight_kg" TYPE NUMERIC(20, 6)
USING "current_weight_kg"::numeric;

ALTER TABLE "patients"
ADD CONSTRAINT "patients_current_weight_kg_positive_check"
CHECK (
  "current_weight_kg" IS NULL
  OR "current_weight_kg" > 0
);

-- Rollback is intentionally not automatic: duplicate names may be valid after this
-- migration, so restoring the old unique index would require an explicit data decision.
