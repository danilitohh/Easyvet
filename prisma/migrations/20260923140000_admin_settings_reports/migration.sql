-- Add the tenant administration audit trail and first-login credential state.
ALTER TABLE "users"
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "OrganizationAuditAction" AS ENUM (
  'MEMBERSHIP_CREATED',
  'MEMBERSHIP_ROLE_UPDATED',
  'MEMBERSHIP_SUSPENDED',
  'MEMBERSHIP_REACTIVATED',
  'ORGANIZATION_UPDATED',
  'CLINIC_LOCATION_CREATED',
  'CLINIC_LOCATION_UPDATED',
  'CLINIC_LOCATION_DEACTIVATED',
  'COMMERCIAL_SETTINGS_UPDATED'
);

CREATE TABLE "organization_audit_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" UUID NOT NULL,
  "actor_membership_id" UUID NOT NULL,
  "action" "OrganizationAuditAction" NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_audit_events_org_created_idx"
ON "organization_audit_events"("organization_id", "created_at" DESC);

CREATE INDEX "organization_audit_events_entity_idx"
ON "organization_audit_events"("organization_id", "entity_type", "entity_id", "created_at" DESC);

ALTER TABLE "organization_audit_events"
ADD CONSTRAINT "organization_audit_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organization_audit_events"
ADD CONSTRAINT "organization_audit_events_actor_membership_id_organization_id_fkey"
FOREIGN KEY ("actor_membership_id", "organization_id")
REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Administrative audit evidence is append-only, including against TRUNCATE.
CREATE FUNCTION organization_audit_events_reject_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Organization audit events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "organization_audit_events_append_only"
BEFORE UPDATE OR DELETE ON "organization_audit_events"
FOR EACH ROW EXECUTE FUNCTION organization_audit_events_reject_mutation();

CREATE TRIGGER "organization_audit_events_no_truncate"
BEFORE TRUNCATE ON "organization_audit_events"
FOR EACH STATEMENT EXECUTE FUNCTION organization_audit_events_reject_mutation();

-- A drawer's currency is historical evidence and must not change after the session is opened.
ALTER TABLE "cash_sessions" ADD COLUMN "currency_code" VARCHAR(3);

-- The existing lifecycle trigger intentionally freezes already-open sessions; this one-time
-- migration backfill updates only the new snapshot column while preserving every ledger field.
ALTER TABLE "cash_sessions" DISABLE TRIGGER "cash_sessions_lifecycle_guard";

UPDATE "cash_sessions" AS session
SET "currency_code" = COALESCE(settings."currency_code", organization."currency_code", 'COP')
FROM "organizations" AS organization
LEFT JOIN "organization_commercial_settings" AS settings
  ON settings."organization_id" = organization."id"
WHERE session."organization_id" = organization."id";

ALTER TABLE "cash_sessions" ENABLE TRIGGER "cash_sessions_lifecycle_guard";

ALTER TABLE "cash_sessions"
ALTER COLUMN "currency_code" SET NOT NULL,
ADD CONSTRAINT "cash_sessions_currency_code_check" CHECK ("currency_code" ~ '^[A-Z]{3}$');

CREATE FUNCTION commercial_guard_cash_session_currency() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."currency_code" <> OLD."currency_code" THEN
    RAISE EXCEPTION 'Cash session currency is an immutable snapshot' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "cash_sessions_currency_immutable"
BEFORE UPDATE ON "cash_sessions"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_cash_session_currency();
