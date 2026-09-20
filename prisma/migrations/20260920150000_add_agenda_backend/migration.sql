-- Agenda 5B adds the operational reservation model without changing prior migrations.
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'WAITING_ROOM', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinic_location_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "assigned_membership_id" UUID,
    "created_by_membership_id" UUID NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "observations" TEXT,
    "owner_confirmed_at" TIMESTAMPTZ(3),
    "clinic_confirmed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_membership_id" UUID,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "availability_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinic_location_id" UUID NOT NULL,
    "membership_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_local_time" VARCHAR(5) NOT NULL,
    "end_local_time" VARCHAR(5) NOT NULL,
    "slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- Enforce interval and civil-time invariants at the database boundary.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_order_check" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "appointments_cancelled_metadata_check" CHECK (
    "status" <> 'CANCELLED'
    OR ("cancelled_at" IS NOT NULL AND "cancelled_by_membership_id" IS NOT NULL)
  );

ALTER TABLE "availability_rules"
  ADD CONSTRAINT "availability_rules_day_check" CHECK ("day_of_week" BETWEEN 0 AND 6),
  ADD CONSTRAINT "availability_rules_slot_check" CHECK ("slot_minutes" BETWEEN 15 AND 240),
  ADD CONSTRAINT "availability_rules_time_format_check" CHECK (
    "start_local_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "end_local_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "end_local_time" > "start_local_time"
  );

CREATE INDEX "appointments_organization_id_starts_at_idx" ON "appointments"("organization_id", "starts_at");
CREATE INDEX "appointments_organization_id_status_starts_at_idx" ON "appointments"("organization_id", "status", "starts_at");
CREATE INDEX "appointments_organization_id_patient_id_starts_at_idx" ON "appointments"("organization_id", "patient_id", "starts_at");
CREATE INDEX "appointments_organization_id_assigned_membership_id_starts__idx" ON "appointments"("organization_id", "assigned_membership_id", "starts_at");
CREATE INDEX "appointments_organization_id_clinic_location_id_starts_at_idx" ON "appointments"("organization_id", "clinic_location_id", "starts_at");
CREATE UNIQUE INDEX "appointments_id_organization_id_key" ON "appointments"("id", "organization_id");
CREATE INDEX "availability_rules_organization_id_clinic_location_id_day_o_idx" ON "availability_rules"("organization_id", "clinic_location_id", "day_of_week", "is_active");
CREATE INDEX "availability_rules_organization_id_membership_id_day_of_wee_idx" ON "availability_rules"("organization_id", "membership_id", "day_of_week", "is_active");
CREATE UNIQUE INDEX "clinic_locations_id_organization_id_key" ON "clinic_locations"("id", "organization_id");
CREATE UNIQUE INDEX "memberships_id_organization_id_key" ON "memberships"("id", "organization_id");
CREATE UNIQUE INDEX "patients_id_organization_id_key" ON "patients"("id", "organization_id");

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_location_id_organization_id_fkey" FOREIGN KEY ("clinic_location_id", "organization_id") REFERENCES "clinic_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_owner_id_organization_id_fkey" FOREIGN KEY ("owner_id", "organization_id") REFERENCES "owners"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_membership_id_organization_id_fkey" FOREIGN KEY ("assigned_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_membership_id_organization_id_fkey" FOREIGN KEY ("cancelled_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_clinic_location_id_organization_id_fkey" FOREIGN KEY ("clinic_location_id", "organization_id") REFERENCES "clinic_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_membership_id_organization_id_fkey" FOREIGN KEY ("membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- btree_gist lets PostgreSQL compare UUID equality alongside tstzrange overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Half-open intervals: [start, end). Completed appointments remain historical blockers.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_patient_overlap_excl" EXCLUDE USING gist (
    "organization_id" WITH =,
    "patient_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('SCHEDULED', 'WAITING_ROOM', 'IN_PROGRESS', 'COMPLETED'));

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_membership_overlap_excl" EXCLUDE USING gist (
    "organization_id" WITH =,
    "assigned_membership_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("assigned_membership_id" IS NOT NULL AND "status" IN ('SCHEDULED', 'WAITING_ROOM', 'IN_PROGRESS', 'COMPLETED'));
