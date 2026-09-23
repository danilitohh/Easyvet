-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SaleItemType" AS ENUM ('PRODUCT', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "SalePaymentStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('SALE_PAYMENT', 'SALE_VOID_REVERSAL', 'MANUAL_IN', 'MANUAL_OUT');

-- CreateEnum
CREATE TYPE "CommercialAuditAction" AS ENUM ('SALE_CREATED', 'SALE_UPDATED', 'SALE_COMPLETED', 'SALE_VOIDED', 'CASH_SESSION_OPENED', 'CASH_MOVEMENT_CREATED', 'CASH_SESSION_CLOSED');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "sale_id" UUID,
ADD COLUMN     "sale_item_id" UUID;

-- CreateTable
CREATE TABLE "organization_commercial_settings" (
    "organization_id" UUID NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "invoice_prefix" VARCHAR(16) NOT NULL,
    "next_invoice_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_commercial_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinic_location_id" UUID NOT NULL,
    "owner_id" UUID,
    "patient_id" UUID,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currency_code" VARCHAR(3) NOT NULL,
    "subtotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "customer_name_snapshot" VARCHAR(300),
    "customer_document_type_snapshot" VARCHAR(80),
    "customer_document_number_snapshot" VARCHAR(120),
    "patient_name_snapshot" VARCHAR(200),
    "created_by_membership_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_membership_id" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "void_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "item_type" "SaleItemType" NOT NULL,
    "inventory_item_id" UUID,
    "inventory_batch_id" UUID,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit_price" DECIMAL(20,4) NOT NULL,
    "discount_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "inventory_item_name_snapshot" VARCHAR(200),
    "sku_snapshot" VARCHAR(100),
    "base_unit_snapshot" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "method" "SalePaymentMethod" NOT NULL,
    "status" "SalePaymentStatus" NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL(20,4) NOT NULL,
    "reference" VARCHAR(500),
    "cash_session_id" UUID,
    "paid_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_membership_id" UUID NOT NULL,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "document_number" VARCHAR(64) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "customer_name_snapshot" VARCHAR(300),
    "customer_document_type_snapshot" VARCHAR(80),
    "customer_document_number_snapshot" VARCHAR(120),
    "patient_name_snapshot" VARCHAR(200),
    "subtotal" DECIMAL(20,4) NOT NULL,
    "discount_total" DECIMAL(20,4) NOT NULL,
    "total" DECIMAL(20,4) NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_membership_id" UUID,
    "void_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clinic_location_id" UUID NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "opening_cash_amount" DECIMAL(20,4) NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_by_membership_id" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_membership_id" UUID,
    "expected_cash_amount" DECIMAL(20,4),
    "counted_cash_amount" DECIMAL(20,4),
    "difference_amount" DECIMAL(20,4),
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cash_session_id" UUID NOT NULL,
    "movement_type" "CashMovementType" NOT NULL,
    "amount_delta" DECIMAL(20,4) NOT NULL,
    "sale_id" UUID,
    "sale_payment_id" UUID,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(1000),
    "reference" VARCHAR(500),
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sale_id" UUID,
    "cash_session_id" UUID,
    "actor_membership_id" UUID NOT NULL,
    "action" "CommercialAuditAction" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_organization_id_status_created_at_id_idx" ON "sales"("organization_id", "status", "created_at" DESC, "id");

-- CreateIndex
CREATE INDEX "sales_organization_id_clinic_location_id_status_created_at__idx" ON "sales"("organization_id", "clinic_location_id", "status", "created_at" DESC, "id");

-- CreateIndex
CREATE INDEX "sales_organization_id_owner_id_created_at_idx" ON "sales"("organization_id", "owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sales_organization_id_patient_id_created_at_idx" ON "sales"("organization_id", "patient_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sales_id_organization_id_key" ON "sales"("id", "organization_id");

-- CreateIndex
CREATE INDEX "sale_items_organization_id_sale_id_position_idx" ON "sale_items"("organization_id", "sale_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sale_items_sale_id_position_key" ON "sale_items"("sale_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sale_items_id_sale_org_item_key" ON "sale_items"("id", "sale_id", "organization_id", "inventory_item_id");

-- CreateIndex
CREATE INDEX "sale_payments_organization_id_sale_id_status_idx" ON "sale_payments"("organization_id", "sale_id", "status");

-- CreateIndex
CREATE INDEX "sale_payments_organization_id_cash_session_id_paid_at_idx" ON "sale_payments"("organization_id", "cash_session_id", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "sale_payments_id_organization_id_key" ON "sale_payments"("id", "organization_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_issued_at_id_idx" ON "invoices"("organization_id", "issued_at" DESC, "id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_issued_at_idx" ON "invoices"("organization_id", "status", "issued_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_document_number_key" ON "invoices"("organization_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_sale_id_organization_id_key" ON "invoices"("sale_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_organization_id_key" ON "invoices"("id", "organization_id");

-- CreateIndex
CREATE INDEX "cash_sessions_organization_id_clinic_location_id_opened_at_idx" ON "cash_sessions"("organization_id", "clinic_location_id", "opened_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cash_sessions_id_organization_id_key" ON "cash_sessions"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_sale_payment_id_key" ON "cash_movements"("sale_payment_id");

-- CreateIndex
CREATE INDEX "cash_movements_organization_id_cash_session_id_occurred_at__idx" ON "cash_movements"("organization_id", "cash_session_id", "occurred_at" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_id_organization_id_key" ON "cash_movements"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_sale_payment_org_key" ON "cash_movements"("sale_payment_id", "organization_id");

-- CreateIndex
CREATE INDEX "commercial_audit_events_organization_id_sale_id_created_at_idx" ON "commercial_audit_events"("organization_id", "sale_id", "created_at");

-- CreateIndex
CREATE INDEX "commercial_audit_events_organization_id_cash_session_id_cre_idx" ON "commercial_audit_events"("organization_id", "cash_session_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_organization_id_sale_id_sale_item_id_idx" ON "inventory_movements"("organization_id", "sale_id", "sale_item_id");

-- RenameForeignKey
ALTER TABLE "inventory_movements" RENAME CONSTRAINT "inventory_movements_created_by_membership_id_organization_id_fk" TO "inventory_movements_created_by_membership_id_organization__fkey";

-- AddForeignKey
ALTER TABLE "organization_commercial_settings" ADD CONSTRAINT "organization_commercial_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_clinic_location_id_organization_id_fkey" FOREIGN KEY ("clinic_location_id", "organization_id") REFERENCES "clinic_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_owner_id_organization_id_fkey" FOREIGN KEY ("owner_id", "organization_id") REFERENCES "owners"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_patient_id_organization_id_fkey" FOREIGN KEY ("patient_id", "organization_id") REFERENCES "patients"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_completed_by_membership_id_organization_id_fkey" FOREIGN KEY ("completed_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_organization_id_fkey" FOREIGN KEY ("sale_id", "organization_id") REFERENCES "sales"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_inventory_item_id_organization_id_fkey" FOREIGN KEY ("inventory_item_id", "organization_id") REFERENCES "inventory_items"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_inventory_batch_id_inventory_item_id_organizati_fkey" FOREIGN KEY ("inventory_batch_id", "inventory_item_id", "organization_id") REFERENCES "inventory_batches"("id", "inventory_item_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_organization_id_fkey" FOREIGN KEY ("sale_id", "organization_id") REFERENCES "sales"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_cash_session_id_organization_id_fkey" FOREIGN KEY ("cash_session_id", "organization_id") REFERENCES "cash_sessions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sale_id_organization_id_fkey" FOREIGN KEY ("sale_id", "organization_id") REFERENCES "sales"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voided_by_membership_id_organization_id_fkey" FOREIGN KEY ("voided_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_clinic_location_id_organization_id_fkey" FOREIGN KEY ("clinic_location_id", "organization_id") REFERENCES "clinic_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_membership_id_organization_id_fkey" FOREIGN KEY ("opened_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_membership_id_organization_id_fkey" FOREIGN KEY ("closed_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_session_id_organization_id_fkey" FOREIGN KEY ("cash_session_id", "organization_id") REFERENCES "cash_sessions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_sale_id_organization_id_fkey" FOREIGN KEY ("sale_id", "organization_id") REFERENCES "sales"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_sale_payment_id_organization_id_fkey" FOREIGN KEY ("sale_payment_id", "organization_id") REFERENCES "sale_payments"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_audit_events" ADD CONSTRAINT "commercial_audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_audit_events" ADD CONSTRAINT "commercial_audit_events_sale_id_organization_id_fkey" FOREIGN KEY ("sale_id", "organization_id") REFERENCES "sales"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_audit_events" ADD CONSTRAINT "commercial_audit_events_cash_session_id_organization_id_fkey" FOREIGN KEY ("cash_session_id", "organization_id") REFERENCES "cash_sessions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_audit_events" ADD CONSTRAINT "commercial_audit_events_actor_membership_id_organization_i_fkey" FOREIGN KEY ("actor_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sale_id_organization_id_fkey" FOREIGN KEY ("sale_id", "organization_id") REFERENCES "sales"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sale_item_id_sale_id_organization_id_i_fkey" FOREIGN KEY ("sale_item_id", "sale_id", "organization_id", "inventory_item_id") REFERENCES "sale_items"("id", "sale_id", "organization_id", "inventory_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing tenants inherit their validated organization currency and start with a safe internal prefix.
INSERT INTO "organization_commercial_settings" ("organization_id", "currency_code", "invoice_prefix", "next_invoice_number", "created_at", "updated_at")
SELECT "id", CASE WHEN "currency_code" ~ '^[A-Z]{3}$' THEN "currency_code" ELSE 'COP' END, 'INV', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations"
ON CONFLICT ("organization_id") DO NOTHING;

-- Database checks backstop service validation for money, lifecycle state, signed ledgers and sequence safety.
ALTER TABLE "organization_commercial_settings"
  ADD CONSTRAINT "organization_commercial_settings_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "organization_commercial_settings_prefix_check" CHECK ("invoice_prefix" ~ '^[A-Z0-9-]{1,16}$'),
  ADD CONSTRAINT "organization_commercial_settings_sequence_check" CHECK ("next_invoice_number" >= 1);

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "sales_totals_check" CHECK (
    "subtotal" >= 0 AND "discount_total" >= 0 AND "grand_total" >= 0
    AND "discount_total" <= "subtotal"
    AND "grand_total" = "subtotal" - "discount_total"
    AND "currency_code" ~ '^[A-Z]{3}$'
  ),
  ADD CONSTRAINT "sales_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "completed_at" IS NULL AND "completed_by_membership_id" IS NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL
      AND "customer_name_snapshot" IS NULL AND "customer_document_type_snapshot" IS NULL
      AND "customer_document_number_snapshot" IS NULL AND "patient_name_snapshot" IS NULL)
    OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "completed_by_membership_id" IS NOT NULL
      AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL)
    OR ("status" = 'VOIDED' AND "completed_at" IS NOT NULL AND "completed_by_membership_id" IS NOT NULL
      AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL
      AND "void_reason" IS NOT NULL AND length(trim("void_reason")) > 0)
  );

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_position_check" CHECK ("position" >= 0),
  ADD CONSTRAINT "sale_items_amount_check" CHECK (
    "quantity" > 0 AND "unit_price" >= 0 AND "discount_amount" >= 0
    AND "discount_amount" <= round("quantity" * "unit_price", 4)
    AND length(trim("description")) > 0
  );

ALTER TABLE "sale_payments"
  ADD CONSTRAINT "sale_payments_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "sale_payments_cash_session_check" CHECK (("method" = 'CASH') = ("cash_session_id" IS NOT NULL)),
  ADD CONSTRAINT "sale_payments_void_state_check" CHECK (
    ("status" = 'POSTED' AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL)
    OR ("status" = 'VOIDED' AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL)
  );

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_totals_check" CHECK (
    "subtotal" >= 0 AND "discount_total" >= 0 AND "discount_total" <= "subtotal"
    AND "total" = "subtotal" - "discount_total" AND "currency_code" ~ '^[A-Z]{3}$'
  ),
  ADD CONSTRAINT "invoices_void_state_check" CHECK (
    ("status" = 'ISSUED' AND "voided_at" IS NULL AND "voided_by_membership_id" IS NULL AND "void_reason" IS NULL)
    OR ("status" = 'VOIDED' AND "voided_at" IS NOT NULL AND "voided_by_membership_id" IS NOT NULL
      AND "void_reason" IS NOT NULL AND length(trim("void_reason")) > 0)
  );

ALTER TABLE "cash_sessions"
  ADD CONSTRAINT "cash_sessions_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "cash_sessions_opening_amount_check" CHECK ("opening_cash_amount" >= 0),
  ADD CONSTRAINT "cash_sessions_close_state_check" CHECK (
    ("status" = 'OPEN' AND "closed_at" IS NULL AND "closed_by_membership_id" IS NULL
      AND "expected_cash_amount" IS NULL AND "counted_cash_amount" IS NULL AND "difference_amount" IS NULL)
    OR ("status" = 'CLOSED' AND "closed_at" IS NOT NULL AND "closed_by_membership_id" IS NOT NULL
      AND "expected_cash_amount" IS NOT NULL AND "counted_cash_amount" IS NOT NULL
      AND "difference_amount" = "counted_cash_amount" - "expected_cash_amount")
  );

ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_amount_type_check" CHECK (
    ("movement_type" IN ('SALE_PAYMENT', 'MANUAL_IN') AND "amount_delta" > 0)
    OR ("movement_type" IN ('SALE_VOID_REVERSAL', 'MANUAL_OUT') AND "amount_delta" < 0)
  ),
  ADD CONSTRAINT "cash_movements_link_check" CHECK (
    ("movement_type" IN ('SALE_PAYMENT', 'SALE_VOID_REVERSAL')) = ("sale_id" IS NOT NULL)
    AND ("movement_type" = 'SALE_PAYMENT') = ("sale_payment_id" IS NOT NULL)
    AND ("movement_type" NOT IN ('MANUAL_IN', 'MANUAL_OUT') OR ("reason" IS NOT NULL AND length(trim("reason")) > 0))
  );

ALTER TABLE "commercial_audit_events"
  ADD CONSTRAINT "commercial_audit_events_target_check" CHECK (("sale_id" IS NULL) <> ("cash_session_id" IS NULL));

ALTER TABLE "inventory_movements"
  DROP CONSTRAINT "inventory_movements_type_sign_check",
  ADD CONSTRAINT "inventory_movements_type_sign_check" CHECK (
    ("movement_type" IN ('RECEIPT', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'SALE_REVERSAL_IN') AND "quantity_delta" > 0)
    OR ("movement_type" IN ('ISSUE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT', 'SALE_OUT') AND "quantity_delta" < 0)
  ),
  ADD CONSTRAINT "inventory_movements_sale_link_check" CHECK (
    ("movement_type" IN ('SALE_OUT', 'SALE_REVERSAL_IN')) = ("sale_id" IS NOT NULL AND "sale_item_id" IS NOT NULL)
  );

-- One active drawer per clinic is enforced by PostgreSQL under concurrent open requests.
CREATE UNIQUE INDEX "cash_sessions_one_open_per_location_key"
  ON "cash_sessions" ("organization_id", "clinic_location_id") WHERE "status" = 'OPEN';

-- A sale line can consume and reverse stock at most once, preserving a single compensating ledger pair.
CREATE UNIQUE INDEX "inventory_movements_sale_item_type_key"
  ON "inventory_movements" ("sale_item_id", "movement_type") WHERE "sale_item_id" IS NOT NULL;

-- Commercial settings never allow invoice number reuse by moving the sequence backwards.
CREATE FUNCTION commercial_guard_settings_update() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."organization_id" <> OLD."organization_id" OR NEW."next_invoice_number" < OLD."next_invoice_number" THEN
    RAISE EXCEPTION 'Commercial settings identity and invoice sequence are monotonic' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

-- Sale-linked stock rows must commit with the matching final Sale lifecycle state.
CREATE FUNCTION commercial_validate_inventory_sale_movement() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "SaleStatus";
  line_quantity DECIMAL(20,6);
  line_item_id UUID;
  line_batch_id UUID;
  line_location_id UUID;
BEGIN
  IF NEW."movement_type" NOT IN ('SALE_OUT', 'SALE_REVERSAL_IN') THEN RETURN NULL; END IF;
  SELECT "status", "clinic_location_id" INTO parent_status, line_location_id
  FROM "sales" WHERE "id" = NEW."sale_id" AND "organization_id" = NEW."organization_id";
  SELECT "quantity", "inventory_item_id", "inventory_batch_id" INTO line_quantity, line_item_id, line_batch_id
  FROM "sale_items" WHERE "id" = NEW."sale_item_id" AND "sale_id" = NEW."sale_id"
    AND "organization_id" = NEW."organization_id" AND "item_type" = 'PRODUCT';
  IF NOT FOUND OR line_location_id <> NEW."clinic_location_id" OR line_item_id <> NEW."inventory_item_id"
    OR line_batch_id IS DISTINCT FROM NEW."inventory_batch_id"
    OR (NEW."movement_type" = 'SALE_OUT' AND (parent_status NOT IN ('COMPLETED', 'VOIDED') OR NEW."quantity_delta" <> -line_quantity))
    OR (NEW."movement_type" = 'SALE_REVERSAL_IN' AND (parent_status <> 'VOIDED' OR NEW."quantity_delta" <> line_quantity)) THEN
    RAISE EXCEPTION 'Sale inventory movements must match a completed or voided sale' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "inventory_sale_movement_commit_guard"
AFTER INSERT ON "inventory_movements"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION commercial_validate_inventory_sale_movement();

CREATE TRIGGER "commercial_settings_guard_update"
BEFORE UPDATE ON "organization_commercial_settings"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_settings_update();

-- Sale lines are draft-only, tenant-bound and checked against current active inventory identity.
CREATE FUNCTION commercial_guard_sale_item() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "SaleStatus";
  lot_tracking BOOLEAN;
  item_status "InventoryItemStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "status" INTO parent_status FROM "sales"
    WHERE "id" = OLD."sale_id" AND "organization_id" = OLD."organization_id" FOR UPDATE;
    IF NOT FOUND OR parent_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Only draft sale items can be removed' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  SELECT "status" INTO parent_status FROM "sales"
  WHERE "id" = NEW."sale_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
  IF NOT FOUND OR parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only draft sale items can be changed' USING ERRCODE = '55000';
  END IF;
  IF NEW."item_type" = 'PRODUCT' THEN
    IF NEW."inventory_item_id" IS NULL THEN
      RAISE EXCEPTION 'Product sale items require an inventory item' USING ERRCODE = '23514';
    END IF;
    SELECT "lot_tracking", "status" INTO lot_tracking, item_status
    FROM "inventory_items"
    WHERE "id" = NEW."inventory_item_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
    IF NOT FOUND OR item_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Product sale items require an active inventory item' USING ERRCODE = '23514';
    END IF;
    IF lot_tracking <> (NEW."inventory_batch_id" IS NOT NULL) THEN
      RAISE EXCEPTION 'Inventory batch does not match lot tracking' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."inventory_item_id" IS NOT NULL OR NEW."inventory_batch_id" IS NOT NULL THEN
    RAISE EXCEPTION 'Only product sale items may reference inventory' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "sale_items_draft_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "sale_items"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_sale_item();

-- Sale transitions use compare-and-swap and completed financial fields are immutable except for void metadata.
CREATE FUNCTION commercial_guard_sale_update() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Sales are never physically deleted' USING ERRCODE = '55000';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Sale changes must increment the version once' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" = 'DRAFT' THEN
    IF NEW."status" NOT IN ('DRAFT', 'COMPLETED') THEN
      RAISE EXCEPTION 'Invalid draft sale transition' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD."status" = 'COMPLETED' THEN
    IF NEW."status" <> 'VOIDED'
      OR NEW."organization_id" <> OLD."organization_id"
      OR NEW."clinic_location_id" <> OLD."clinic_location_id"
      OR NEW."owner_id" IS DISTINCT FROM OLD."owner_id"
      OR NEW."patient_id" IS DISTINCT FROM OLD."patient_id"
      OR NEW."currency_code" <> OLD."currency_code"
      OR NEW."subtotal" <> OLD."subtotal"
      OR NEW."discount_total" <> OLD."discount_total"
      OR NEW."grand_total" <> OLD."grand_total"
      OR NEW."customer_name_snapshot" IS DISTINCT FROM OLD."customer_name_snapshot"
      OR NEW."customer_document_type_snapshot" IS DISTINCT FROM OLD."customer_document_type_snapshot"
      OR NEW."customer_document_number_snapshot" IS DISTINCT FROM OLD."customer_document_number_snapshot"
      OR NEW."patient_name_snapshot" IS DISTINCT FROM OLD."patient_name_snapshot"
      OR NEW."created_by_membership_id" <> OLD."created_by_membership_id"
      OR NEW."completed_at" <> OLD."completed_at"
      OR NEW."completed_by_membership_id" <> OLD."completed_by_membership_id"
      OR NEW."voided_at" IS NULL OR NEW."voided_by_membership_id" IS NULL
      OR length(trim(NEW."void_reason")) = 0 THEN
      RAISE EXCEPTION 'Completed sales may only transition to voided' USING ERRCODE = '55000';
    END IF;
  ELSE
    RAISE EXCEPTION 'Voided sales are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "sales_lifecycle_guard"
BEFORE UPDATE OR DELETE ON "sales"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_sale_update();

-- Sale payment evidence may be voided once but never edited or physically removed.
CREATE FUNCTION commercial_guard_sale_payment() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "SaleStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Sale payments are append-only' USING ERRCODE = '55000';
  END IF;
  SELECT "status" INTO parent_status FROM "sales"
  WHERE "id" = OLD."sale_id" AND "organization_id" = OLD."organization_id" FOR UPDATE;
  IF OLD."status" <> 'POSTED' OR NEW."status" <> 'VOIDED'
    OR parent_status <> 'COMPLETED'
    OR NEW."id" <> OLD."id" OR NEW."organization_id" <> OLD."organization_id"
    OR NEW."sale_id" <> OLD."sale_id" OR NEW."method" <> OLD."method"
    OR NEW."amount" <> OLD."amount" OR NEW."reference" IS DISTINCT FROM OLD."reference"
    OR NEW."cash_session_id" IS DISTINCT FROM OLD."cash_session_id"
    OR NEW."paid_at" <> OLD."paid_at" OR NEW."created_by_membership_id" <> OLD."created_by_membership_id"
    OR NEW."voided_at" IS NULL OR NEW."voided_by_membership_id" IS NULL THEN
    RAISE EXCEPTION 'Posted sale payments may only be voided with their completed sale' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "sale_payments_lifecycle_guard"
BEFORE UPDATE OR DELETE ON "sale_payments"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_sale_payment();

-- New payment evidence can only be attached to a draft and cash must use its active location drawer.
CREATE FUNCTION commercial_guard_sale_payment_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "SaleStatus";
  sale_location_id UUID;
  cash_status "CashSessionStatus";
  cash_location_id UUID;
BEGIN
  SELECT "status", "clinic_location_id" INTO parent_status, sale_location_id
  FROM "sales" WHERE "id" = NEW."sale_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
  IF NOT FOUND OR parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Payments can only be posted while completing a draft sale' USING ERRCODE = '23514';
  END IF;
  IF NEW."method" = 'CASH' THEN
    SELECT "status", "clinic_location_id" INTO cash_status, cash_location_id
    FROM "cash_sessions" WHERE "id" = NEW."cash_session_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
    IF NOT FOUND OR cash_status <> 'OPEN' OR cash_location_id <> sale_location_id THEN
      RAISE EXCEPTION 'Cash payments require an open drawer at the sale location' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "sale_payments_draft_insert_guard"
BEFORE INSERT ON "sale_payments"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_sale_payment_insert();

-- Invoice identity and totals are immutable; only the parent Sale may void the internal invoice.
CREATE FUNCTION commercial_guard_invoice() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Invoices are never physically deleted' USING ERRCODE = '55000';
  END IF;
  IF OLD."status" <> 'ISSUED' OR NEW."status" <> 'VOIDED'
    OR NEW."id" <> OLD."id" OR NEW."organization_id" <> OLD."organization_id"
    OR NEW."sale_id" <> OLD."sale_id" OR NEW."document_number" <> OLD."document_number"
    OR NEW."currency_code" <> OLD."currency_code"
    OR NEW."customer_name_snapshot" IS DISTINCT FROM OLD."customer_name_snapshot"
    OR NEW."customer_document_type_snapshot" IS DISTINCT FROM OLD."customer_document_type_snapshot"
    OR NEW."customer_document_number_snapshot" IS DISTINCT FROM OLD."customer_document_number_snapshot"
    OR NEW."patient_name_snapshot" IS DISTINCT FROM OLD."patient_name_snapshot"
    OR NEW."subtotal" <> OLD."subtotal" OR NEW."discount_total" <> OLD."discount_total"
    OR NEW."total" <> OLD."total" OR NEW."issued_at" <> OLD."issued_at"
    OR NEW."voided_at" IS NULL OR NEW."voided_by_membership_id" IS NULL
    OR NEW."void_reason" IS NULL OR length(trim(NEW."void_reason")) = 0 THEN
    RAISE EXCEPTION 'Issued invoices may only be voided with their sale' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "invoices_lifecycle_guard"
BEFORE UPDATE OR DELETE ON "invoices"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_invoice();

-- The internal invoice is issued only inside the transaction completing its draft Sale.
CREATE FUNCTION commercial_guard_invoice_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "SaleStatus";
BEGIN
  SELECT "status" INTO parent_status FROM "sales"
  WHERE "id" = NEW."sale_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
  IF NOT FOUND OR parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Invoices can only be issued while completing a draft sale' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "invoices_draft_insert_guard"
BEFORE INSERT ON "invoices"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_invoice_insert();

-- Cash sessions can only remain open with a versioned write or close once against their locked ledger.
CREATE FUNCTION commercial_guard_cash_session() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ledger_expected DECIMAL(20,4);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cash sessions are never physically deleted' USING ERRCODE = '55000';
  END IF;
  IF NEW."version" <> OLD."version" + 1 OR NEW."organization_id" <> OLD."organization_id"
    OR NEW."clinic_location_id" <> OLD."clinic_location_id"
    OR NEW."opening_cash_amount" <> OLD."opening_cash_amount"
    OR NEW."opened_at" <> OLD."opened_at"
    OR NEW."opened_by_membership_id" <> OLD."opened_by_membership_id" THEN
    RAISE EXCEPTION 'Cash session writes must be versioned and preserve opening identity' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" <> 'OPEN' THEN
    RAISE EXCEPTION 'Closed cash sessions are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."status" = 'CLOSED' THEN
    SELECT OLD."opening_cash_amount" + COALESCE(SUM("amount_delta"), 0)
      INTO ledger_expected FROM "cash_movements"
      WHERE "organization_id" = OLD."organization_id" AND "cash_session_id" = OLD."id";
    IF NEW."closed_at" IS NULL OR NEW."closed_by_membership_id" IS NULL
      OR NEW."expected_cash_amount" <> ledger_expected
      OR NEW."difference_amount" <> NEW."counted_cash_amount" - ledger_expected THEN
      RAISE EXCEPTION 'Cash close totals must match its immutable ledger' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."status" <> 'OPEN' OR NEW."closed_at" IS NOT NULL
    OR NEW."closed_by_membership_id" IS NOT NULL OR NEW."expected_cash_amount" IS NOT NULL
    OR NEW."counted_cash_amount" IS NOT NULL OR NEW."difference_amount" IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid open cash session transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "cash_sessions_lifecycle_guard"
BEFORE UPDATE OR DELETE ON "cash_sessions"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_cash_session();

-- Drawer postings lock and re-check the session at the database boundary, including Sale tenders.
CREATE FUNCTION commercial_guard_cash_movement_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  session_status "CashSessionStatus";
  payment_sale_id UUID;
  payment_session_id UUID;
  payment_amount DECIMAL(20,4);
  payment_method "SalePaymentMethod";
  parent_sale_status "SaleStatus";
BEGIN
  SELECT "status" INTO session_status FROM "cash_sessions"
  WHERE "id" = NEW."cash_session_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
  IF NOT FOUND OR session_status <> 'OPEN' THEN
    RAISE EXCEPTION 'Cash movements require an open cash session' USING ERRCODE = '23514';
  END IF;
  IF NEW."movement_type" = 'SALE_PAYMENT' THEN
    SELECT "sale_id", "cash_session_id", "amount", "method" INTO payment_sale_id, payment_session_id, payment_amount, payment_method
    FROM "sale_payments"
    WHERE "id" = NEW."sale_payment_id" AND "organization_id" = NEW."organization_id" AND "status" = 'POSTED';
    IF NOT FOUND OR payment_method <> 'CASH' OR payment_sale_id <> NEW."sale_id"
      OR payment_session_id <> NEW."cash_session_id" OR payment_amount <> NEW."amount_delta" THEN
      RAISE EXCEPTION 'Cash sale movement must match its posted CASH payment' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."movement_type" = 'SALE_VOID_REVERSAL' THEN
    SELECT "status" INTO parent_sale_status FROM "sales"
    WHERE "id" = NEW."sale_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
    IF NOT FOUND OR parent_sale_status <> 'COMPLETED' THEN
      RAISE EXCEPTION 'Cash reversal requires a completed sale' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "cash_movements_open_session_guard"
BEFORE INSERT ON "cash_movements"
FOR EACH ROW EXECUTE FUNCTION commercial_guard_cash_movement_insert();

-- Financial movements and commercial audit rows are append-only, with no truncate escape hatch.
CREATE FUNCTION commercial_reject_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Commercial ledger and audit evidence are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "cash_movements_append_only"
BEFORE UPDATE OR DELETE ON "cash_movements"
FOR EACH ROW EXECUTE FUNCTION commercial_reject_ledger_mutation();
CREATE TRIGGER "cash_movements_no_truncate"
BEFORE TRUNCATE ON "cash_movements"
FOR EACH STATEMENT EXECUTE FUNCTION commercial_reject_ledger_mutation();
CREATE TRIGGER "commercial_audit_events_append_only"
BEFORE UPDATE OR DELETE ON "commercial_audit_events"
FOR EACH ROW EXECUTE FUNCTION commercial_reject_ledger_mutation();
CREATE TRIGGER "commercial_audit_events_no_truncate"
BEFORE TRUNCATE ON "commercial_audit_events"
FOR EACH STATEMENT EXECUTE FUNCTION commercial_reject_ledger_mutation();

-- Deferred checks require completed and voided sales to commit with complete invoice/payment/stock evidence.
CREATE FUNCTION commercial_validate_sale_commit() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_sale "sales"%ROWTYPE;
  item_count INTEGER;
  payment_total DECIMAL(20,4);
  invoice_count INTEGER;
  bad_stock_count INTEGER;
  cash_payment_count INTEGER;
  cash_movement_count INTEGER;
  cash_reversal_count INTEGER;
  cash_reversal_total DECIMAL(20,4);
BEGIN
  SELECT * INTO current_sale FROM "sales" WHERE "id" = NEW."id" AND "organization_id" = NEW."organization_id";
  IF NOT FOUND OR current_sale."status" = 'DRAFT' THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO item_count FROM "sale_items"
  WHERE "sale_id" = current_sale."id" AND "organization_id" = current_sale."organization_id";
  SELECT COALESCE(SUM("amount"), 0) INTO payment_total FROM "sale_payments"
  WHERE "sale_id" = current_sale."id" AND "organization_id" = current_sale."organization_id" AND "status" = 'POSTED';
  SELECT COUNT(*) INTO invoice_count FROM "invoices"
  WHERE "sale_id" = current_sale."id" AND "organization_id" = current_sale."organization_id"
    AND "status" = CASE WHEN current_sale."status" = 'COMPLETED' THEN 'ISSUED'::"InvoiceStatus" ELSE 'VOIDED'::"InvoiceStatus" END;

  IF current_sale."status" = 'COMPLETED' THEN
    IF item_count < 1 OR payment_total <> current_sale."grand_total" OR invoice_count <> 1 THEN
      RAISE EXCEPTION 'Completed sales require items, exact posted payments and one issued invoice' USING ERRCODE = '23514';
    END IF;
    SELECT COUNT(*) INTO bad_stock_count
    FROM "sale_items" si
    WHERE si."sale_id" = current_sale."id" AND si."organization_id" = current_sale."organization_id"
      AND ((si."item_type" = 'PRODUCT' AND NOT EXISTS (
        SELECT 1 FROM "inventory_movements" im
        WHERE im."sale_item_id" = si."id" AND im."sale_id" = current_sale."id"
          AND im."organization_id" = current_sale."organization_id" AND im."movement_type" = 'SALE_OUT'
          AND im."inventory_item_id" = si."inventory_item_id" AND im."inventory_batch_id" IS NOT DISTINCT FROM si."inventory_batch_id"
          AND im."clinic_location_id" = current_sale."clinic_location_id" AND im."quantity_delta" = -si."quantity"
      )) OR (si."item_type" <> 'PRODUCT' AND EXISTS (
        SELECT 1 FROM "inventory_movements" im WHERE im."sale_item_id" = si."id" AND im."organization_id" = current_sale."organization_id"
      )));
    IF bad_stock_count <> 0 THEN
      RAISE EXCEPTION 'Completed sale product lines require matching SALE_OUT evidence' USING ERRCODE = '23514';
    END IF;
    SELECT COUNT(*) INTO cash_payment_count FROM "sale_payments"
    WHERE "sale_id" = current_sale."id" AND "organization_id" = current_sale."organization_id" AND "status" = 'POSTED' AND "method" = 'CASH';
    SELECT COUNT(*) INTO cash_movement_count FROM "cash_movements"
    WHERE "sale_id" = current_sale."id" AND "organization_id" = current_sale."organization_id" AND "movement_type" = 'SALE_PAYMENT';
    IF cash_payment_count <> cash_movement_count THEN
      RAISE EXCEPTION 'Every CASH payment requires one matching cash movement' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF invoice_count <> 1 OR EXISTS (
      SELECT 1 FROM "sale_payments" WHERE "sale_id" = current_sale."id"
        AND "organization_id" = current_sale."organization_id" AND "status" <> 'VOIDED'
    ) THEN
      RAISE EXCEPTION 'Voided sales require a voided invoice and voided payment evidence' USING ERRCODE = '23514';
    END IF;
    SELECT COUNT(*) INTO bad_stock_count
    FROM "sale_items" si
    WHERE si."sale_id" = current_sale."id" AND si."organization_id" = current_sale."organization_id"
      AND si."item_type" = 'PRODUCT' AND (
        (SELECT COUNT(*) FROM "inventory_movements" im WHERE im."sale_item_id" = si."id"
          AND im."sale_id" = current_sale."id" AND im."organization_id" = current_sale."organization_id"
          AND im."movement_type" = 'SALE_OUT' AND im."quantity_delta" = -si."quantity") <> 1
        OR (SELECT COUNT(*) FROM "inventory_movements" im WHERE im."sale_item_id" = si."id"
          AND im."sale_id" = current_sale."id" AND im."organization_id" = current_sale."organization_id"
          AND im."movement_type" = 'SALE_REVERSAL_IN' AND im."quantity_delta" = si."quantity") <> 1
      );
    IF bad_stock_count <> 0 THEN
      RAISE EXCEPTION 'Voided sale product lines require matching stock reversal evidence' USING ERRCODE = '23514';
    END IF;
    SELECT COUNT(*), COALESCE(SUM("amount_delta"), 0) INTO cash_reversal_count, cash_reversal_total
    FROM "cash_movements" WHERE "sale_id" = current_sale."id" AND "organization_id" = current_sale."organization_id"
      AND "movement_type" = 'SALE_VOID_REVERSAL';
    SELECT COUNT(*) INTO cash_payment_count FROM "sale_payments"
    WHERE "sale_id" = current_sale."id" AND "organization_id" = current_sale."organization_id" AND "method" = 'CASH';
    SELECT COALESCE(SUM("amount"), 0) INTO payment_total FROM "sale_payments"
    WHERE "sale_id" = current_sale."id" AND "organization_id" = current_sale."organization_id" AND "method" = 'CASH';
    IF cash_payment_count <> cash_reversal_count OR cash_reversal_total <> -payment_total THEN
      RAISE EXCEPTION 'Voided cash tenders require matching negative drawer reversals' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "sales_commit_evidence_guard"
AFTER INSERT OR UPDATE ON "sales"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION commercial_validate_sale_commit();

-- Sale reversals may return history to an inactive location; every other inventory movement still requires ACTIVE.
CREATE OR REPLACE FUNCTION inventory_guard_movement_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_lot_tracking BOOLEAN;
  item_status "InventoryItemStatus";
  location_status "ClinicLocationStatus";
  existing_quantity DECIMAL(20,6);
BEGIN
  SELECT "lot_tracking", "status" INTO item_lot_tracking, item_status
  FROM "inventory_items"
  WHERE "id" = NEW."inventory_item_id" AND "organization_id" = NEW."organization_id"
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item does not exist for this organization' USING ERRCODE = '23503'; END IF;
  IF item_status <> 'ACTIVE' THEN RAISE EXCEPTION 'Archived inventory items cannot receive movements' USING ERRCODE = '23514'; END IF;

  SELECT "status" INTO location_status FROM "clinic_locations"
  WHERE "id" = NEW."clinic_location_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory location does not exist for this organization' USING ERRCODE = '23503'; END IF;
  IF location_status <> 'ACTIVE' AND NEW."movement_type" <> 'SALE_REVERSAL_IN' THEN
    RAISE EXCEPTION 'Inventory movements require an active location' USING ERRCODE = '23514';
  END IF;

  IF (item_lot_tracking AND NEW."inventory_batch_id" IS NULL)
    OR (NOT item_lot_tracking AND NEW."inventory_batch_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'Inventory batch does not match item lot tracking' USING ERRCODE = '23514';
  END IF;
  IF NEW."quantity_delta" < 0 THEN
    SELECT COALESCE(SUM("quantity_delta"), 0) INTO existing_quantity FROM "inventory_movements"
    WHERE "organization_id" = NEW."organization_id" AND "inventory_item_id" = NEW."inventory_item_id"
      AND "clinic_location_id" = NEW."clinic_location_id"
      AND "inventory_batch_id" IS NOT DISTINCT FROM NEW."inventory_batch_id";
    IF existing_quantity + NEW."quantity_delta" < 0 THEN
      RAISE EXCEPTION 'Inventory stock cannot be negative' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
