CREATE TYPE "PlatformAuditAction" AS ENUM ('ORGANIZATION_STATUS_CHANGED');

CREATE TABLE "platform_audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "organization_id" UUID,
    "action" "PlatformAuditAction" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_audit_events_created_idx"
ON "platform_audit_events"("created_at" DESC);

CREATE INDEX "platform_audit_events_org_created_idx"
ON "platform_audit_events"("organization_id", "created_at" DESC);

ALTER TABLE "platform_audit_events"
ADD CONSTRAINT "platform_audit_events_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_audit_events"
ADD CONSTRAINT "platform_audit_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
