-- Keep lifecycle state and archive timestamp as one invariant.
ALTER TABLE "owners"
ADD CONSTRAINT "owners_status_archived_at_check"
CHECK (
  ("status" = 'ACTIVE' AND "archived_at" IS NULL)
  OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
);

ALTER TABLE "patients"
ADD CONSTRAINT "patients_status_archived_at_check"
CHECK (
  ("status" = 'ACTIVE' AND "archived_at" IS NULL)
  OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
);

-- A ficha snapshot is bounded at the API and database boundaries.
ALTER TABLE "patients"
ADD CONSTRAINT "patients_current_weight_kg_check"
CHECK (
  "current_weight_kg" IS NULL
  OR ("current_weight_kg" > 0 AND "current_weight_kg" <= 1000)
);

-- Preserve the legacy duplicate-name rule for active patients without blocking reuse after archive.
CREATE UNIQUE INDEX "patients_org_owner_name_active_key"
ON "patients" ("organization_id", "owner_id", "name_normalized")
WHERE "status" = 'ACTIVE';
