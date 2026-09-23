-- CreateEnum
CREATE TYPE "GroomingVisitStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "OperationalAuditAction" AS ENUM ('GROOMING_CREATED', 'GROOMING_UPDATED', 'GROOMING_STARTED', 'GROOMING_COMPLETED', 'GROOMING_VOIDED');

-- CreateTable
CREATE TABLE "grooming_visits" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "owner_id_at_time" UUID NOT NULL,
    "clinic_location_id" UUID NOT NULL,
    "appointment_id" UUID,
    "assigned_groomer_membership_id" UUID,
    "created_by_membership_id" UUID NOT NULL,
    "started_by_membership_id" UUID,
    "completed_by_membership_id" UUID,
    "voided_by_membership_id" UUID,
    "status" "GroomingVisitStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "service_summary" VARCHAR(1000),
    "coat_condition" VARCHAR(5000),
    "skin_observations" VARCHAR(5000),
    "temperament_notes" VARCHAR(5000),
    "pre_service_notes" VARCHAR(5000),
    "post_service_notes" VARCHAR(5000),
    "incident_notes" VARCHAR(5000),
    "patient_name_snapshot" VARCHAR(200),
    "owner_display_name_snapshot" VARCHAR(200),
    "groomer_display_name_snapshot" VARCHAR(200),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "grooming_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "grooming_visit_id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "action" "OperationalAuditAction" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grooming_visits_org_status_updated_idx" ON "grooming_visits"("organization_id", "status", "updated_at" DESC, "id");

-- CreateIndex
CREATE INDEX "grooming_visits_org_patient_created_idx" ON "grooming_visits"("organization_id", "patient_id", "created_at" DESC, "id");

-- CreateIndex
CREATE INDEX "grooming_visits_org_location_status_idx" ON "grooming_visits"("organization_id", "clinic_location_id", "status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "grooming_visits_org_groomer_status_idx" ON "grooming_visits"("organization_id", "assigned_groomer_membership_id", "status", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "grooming_visits_id_organization_id_key" ON "grooming_visits"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "grooming_visits_appointment_org_key" ON "grooming_visits"("appointment_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "grooming_visits_appointment_patient_location_key" ON "grooming_visits"("appointment_id", "organization_id", "patient_id", "clinic_location_id");

-- CreateIndex
CREATE INDEX "operational_audit_events_org_grooming_created_idx" ON "operational_audit_events"("organization_id", "grooming_visit_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_id_org_patient_location_key" ON "appointments"("id", "organization_id", "patient_id", "clinic_location_id");

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_owner_id_at_time_organization_id_fkey" FOREIGN KEY ("owner_id_at_time", "organization_id") REFERENCES "owners"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_clinic_location_id_organization_id_fkey" FOREIGN KEY ("clinic_location_id", "organization_id") REFERENCES "clinic_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_appointment_id_organization_id_patient_id__fkey" FOREIGN KEY ("appointment_id", "organization_id", "patient_id", "clinic_location_id") REFERENCES "appointments"("id", "organization_id", "patient_id", "clinic_location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_assigned_groomer_membership_id_organizatio_fkey" FOREIGN KEY ("assigned_groomer_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_started_by_membership_id_organization_id_fkey" FOREIGN KEY ("started_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_completed_by_membership_id_organization_id_fkey" FOREIGN KEY ("completed_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_audit_events" ADD CONSTRAINT "operational_audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_audit_events" ADD CONSTRAINT "operational_audit_events_grooming_visit_id_organization_id_fkey" FOREIGN KEY ("grooming_visit_id", "organization_id") REFERENCES "grooming_visits"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_audit_events" ADD CONSTRAINT "operational_audit_events_actor_membership_id_organization__fkey" FOREIGN KEY ("actor_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lifecycle checks also protect invariant-only columns when writes bypass the API.
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_version_positive_check" CHECK ("version" > 0);
ALTER TABLE "grooming_visits" ADD CONSTRAINT "grooming_visits_lifecycle_consistency_check" CHECK (
    (("started_at" IS NULL) = ("started_by_membership_id" IS NULL))
    AND (("completed_at" IS NULL) = ("completed_by_membership_id" IS NULL))
    AND (("voided_at" IS NULL) = ("voided_by_membership_id" IS NULL))
    AND (("voided_at" IS NULL) = ("void_reason" IS NULL))
    AND ("void_reason" IS NULL OR length(trim("void_reason")) > 0)
    AND (
        ("status" = 'DRAFT' AND "started_at" IS NULL AND "completed_at" IS NULL AND "voided_at" IS NULL
            AND "patient_name_snapshot" IS NULL AND "owner_display_name_snapshot" IS NULL AND "groomer_display_name_snapshot" IS NULL)
        OR
        ("status" = 'IN_PROGRESS' AND "service_summary" IS NOT NULL AND length(trim("service_summary")) > 0
            AND "assigned_groomer_membership_id" IS NOT NULL AND "started_at" IS NOT NULL
            AND length(trim("patient_name_snapshot")) > 0 AND length(trim("owner_display_name_snapshot")) > 0
            AND length(trim("groomer_display_name_snapshot")) > 0 AND "completed_at" IS NULL AND "voided_at" IS NULL)
        OR
        ("status" = 'COMPLETED' AND "service_summary" IS NOT NULL AND length(trim("service_summary")) > 0
            AND "assigned_groomer_membership_id" IS NOT NULL AND "started_at" IS NOT NULL AND "completed_at" IS NOT NULL
            AND length(trim("patient_name_snapshot")) > 0 AND length(trim("owner_display_name_snapshot")) > 0
            AND length(trim("groomer_display_name_snapshot")) > 0 AND "voided_at" IS NULL)
        OR
        ("status" = 'VOIDED' AND "service_summary" IS NOT NULL AND length(trim("service_summary")) > 0
            AND "assigned_groomer_membership_id" IS NOT NULL AND "started_at" IS NOT NULL AND "voided_at" IS NOT NULL
            AND length(trim("patient_name_snapshot")) > 0 AND length(trim("owner_display_name_snapshot")) > 0
            AND length(trim("groomer_display_name_snapshot")) > 0 AND length(trim("void_reason")) > 0)
    )
    AND ("completed_at" IS NULL OR "completed_at" >= "started_at")
    AND ("voided_at" IS NULL OR "voided_at" >= "started_at")
);
