-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('MEDICATION', 'SUPPLY', 'RETAIL', 'OTHER');
CREATE TYPE "InventoryItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sku" VARCHAR(100),
    "item_type" "InventoryItemType" NOT NULL,
    "base_unit" VARCHAR(40) NOT NULL,
    "lot_tracking" BOOLEAN NOT NULL DEFAULT false,
    "minimum_stock" DECIMAL(20,6),
    "description" VARCHAR(2000),
    "notes" VARCHAR(5000),
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "lot_number" VARCHAR(120) NOT NULL,
    "expiry_on" DATE,
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "clinic_location_id" UUID NOT NULL,
    "inventory_batch_id" UUID,
    "movement_type" "InventoryMovementType" NOT NULL,
    "quantity_delta" DECIMAL(20,6) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(2000) NOT NULL,
    "reference" VARCHAR(500),
    "unit_cost" DECIMAL(20,6),
    "transfer_group_id" UUID,
    "created_by_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "inventory_items_id_organization_id_key" ON "inventory_items"("id", "organization_id");
CREATE UNIQUE INDEX "inventory_items_organization_id_sku_key" ON "inventory_items"("organization_id", "sku");
CREATE INDEX "inventory_items_organization_id_status_name_idx" ON "inventory_items"("organization_id", "status", "name");
CREATE INDEX "inventory_items_organization_id_item_type_status_idx" ON "inventory_items"("organization_id", "item_type", "status");

CREATE UNIQUE INDEX "inventory_batches_id_item_org_key" ON "inventory_batches"("id", "inventory_item_id", "organization_id");
CREATE UNIQUE INDEX "inventory_batches_org_item_lot_key" ON "inventory_batches"("organization_id", "inventory_item_id", "lot_number");
CREATE INDEX "inventory_batches_organization_id_inventory_item_id_expiry__idx" ON "inventory_batches"("organization_id", "inventory_item_id", "expiry_on");

CREATE INDEX "inventory_movements_organization_id_inventory_item_id_clini_idx"
  ON "inventory_movements"("organization_id", "inventory_item_id", "clinic_location_id", "occurred_at" DESC, "created_at" DESC, "id");
CREATE INDEX "inventory_movements_organization_id_inventory_item_id_inven_idx"
  ON "inventory_movements"("organization_id", "inventory_item_id", "inventory_batch_id", "clinic_location_id");
CREATE INDEX "inventory_movements_organization_id_transfer_group_id_idx"
  ON "inventory_movements"("organization_id", "transfer_group_id");

-- Checks protect bounded metadata, decimal validity and movement signs even when a writer bypasses NestJS.
ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_name_unit_sku_check" CHECK (
    length(trim("name")) > 0
    AND length(trim("base_unit")) > 0
    AND ("sku" IS NULL OR (length(trim("sku")) > 0 AND "sku" = upper(trim("sku"))))
  ),
  ADD CONSTRAINT "inventory_items_minimum_stock_check" CHECK ("minimum_stock" IS NULL OR "minimum_stock" >= 0);

ALTER TABLE "inventory_batches"
  ADD CONSTRAINT "inventory_batches_lot_number_check" CHECK (length(trim("lot_number")) > 0);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_quantity_reason_check" CHECK (
    "quantity_delta" <> 0 AND length(trim("reason")) > 0
  ),
  ADD CONSTRAINT "inventory_movements_unit_cost_check" CHECK ("unit_cost" IS NULL OR "unit_cost" >= 0),
  ADD CONSTRAINT "inventory_movements_type_sign_check" CHECK (
    ("movement_type" IN ('RECEIPT', 'ADJUSTMENT_IN', 'TRANSFER_IN') AND "quantity_delta" > 0)
    OR ("movement_type" IN ('ISSUE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT') AND "quantity_delta" < 0)
  ),
  ADD CONSTRAINT "inventory_movements_transfer_group_check" CHECK (
    ("movement_type" IN ('TRANSFER_IN', 'TRANSFER_OUT')) = ("transfer_group_id" IS NOT NULL)
  );

-- Tenant-composite foreign keys prevent cross-organization item, location, batch and actor references.
ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_batches"
  ADD CONSTRAINT "inventory_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_batches_inventory_item_id_organization_id_fkey" FOREIGN KEY ("inventory_item_id", "organization_id") REFERENCES "inventory_items"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_movements_inventory_item_id_organization_id_fkey" FOREIGN KEY ("inventory_item_id", "organization_id") REFERENCES "inventory_items"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_movements_clinic_location_id_organization_id_fkey" FOREIGN KEY ("clinic_location_id", "organization_id") REFERENCES "clinic_locations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_movements_inventory_batch_id_inventory_item_id_o_fkey" FOREIGN KEY ("inventory_batch_id", "inventory_item_id", "organization_id") REFERENCES "inventory_batches"("id", "inventory_item_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_movements_created_by_membership_id_organization_id_fkey" FOREIGN KEY ("created_by_membership_id", "organization_id") REFERENCES "memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The trigger re-locks the item as a database backstop and rejects negative stock atomically.
CREATE FUNCTION inventory_guard_movement_insert() RETURNS trigger
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item does not exist for this organization' USING ERRCODE = '23503';
  END IF;

  IF item_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Archived inventory items cannot receive movements' USING ERRCODE = '23514';
  END IF;

  SELECT "status" INTO location_status
  FROM "clinic_locations"
  WHERE "id" = NEW."clinic_location_id" AND "organization_id" = NEW."organization_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory location does not exist for this organization' USING ERRCODE = '23503';
  END IF;

  IF location_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Inventory movements require an active location' USING ERRCODE = '23514';
  END IF;

  IF (item_lot_tracking AND NEW."inventory_batch_id" IS NULL)
     OR (NOT item_lot_tracking AND NEW."inventory_batch_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'Inventory batch does not match item lot tracking' USING ERRCODE = '23514';
  END IF;

  IF NEW."quantity_delta" < 0 THEN
    SELECT COALESCE(SUM("quantity_delta"), 0) INTO existing_quantity
    FROM "inventory_movements"
    WHERE "organization_id" = NEW."organization_id"
      AND "inventory_item_id" = NEW."inventory_item_id"
      AND "clinic_location_id" = NEW."clinic_location_id"
      AND "inventory_batch_id" IS NOT DISTINCT FROM NEW."inventory_batch_id";

    IF existing_quantity + NEW."quantity_delta" < 0 THEN
      RAISE EXCEPTION 'Inventory stock cannot be negative' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "inventory_movements_guard_insert"
BEFORE INSERT ON "inventory_movements"
FOR EACH ROW EXECUTE FUNCTION inventory_guard_movement_insert();

-- Movement rows, including history, may only be corrected by appending compensating entries.
CREATE FUNCTION inventory_reject_movement_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Inventory movements are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "inventory_movements_append_only"
BEFORE UPDATE OR DELETE ON "inventory_movements"
FOR EACH ROW EXECUTE FUNCTION inventory_reject_movement_mutation();

CREATE FUNCTION inventory_reject_movement_truncate() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Inventory movements are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "inventory_movements_no_truncate"
BEFORE TRUNCATE ON "inventory_movements"
FOR EACH STATEMENT EXECUTE FUNCTION inventory_reject_movement_truncate();

-- A batch's tenant, parent item and lot identity can never be rewritten after creation.
CREATE FUNCTION inventory_guard_batch_identity() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."id" <> OLD."id"
     OR NEW."organization_id" <> OLD."organization_id"
     OR NEW."inventory_item_id" <> OLD."inventory_item_id"
     OR NEW."lot_number" <> OLD."lot_number" THEN
    RAISE EXCEPTION 'Inventory batch identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "inventory_batches_identity_immutable"
BEFORE UPDATE ON "inventory_batches"
FOR EACH ROW EXECUTE FUNCTION inventory_guard_batch_identity();

-- Deferred validation ensures each committed transfer group is a balanced OUT/IN pair.
CREATE FUNCTION inventory_validate_transfer_pair() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  pair_count INTEGER;
  net_quantity DECIMAL(20,6);
  out_count INTEGER;
  in_count INTEGER;
  matching_context_count INTEGER;
  matching_location_count INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM("quantity_delta"), 0),
         COUNT(*) FILTER (WHERE "movement_type" = 'TRANSFER_OUT'),
         COUNT(*) FILTER (WHERE "movement_type" = 'TRANSFER_IN'),
         COUNT(DISTINCT ("organization_id", "inventory_item_id", "inventory_batch_id")),
         COUNT(DISTINCT "clinic_location_id")
    INTO pair_count, net_quantity, out_count, in_count, matching_context_count, matching_location_count
  FROM "inventory_movements"
  WHERE "organization_id" = NEW."organization_id" AND "transfer_group_id" = NEW."transfer_group_id";

  IF pair_count <> 2 OR out_count <> 1 OR in_count <> 1 OR net_quantity <> 0
     OR matching_context_count <> 1 OR matching_location_count <> 2 THEN
    RAISE EXCEPTION 'Inventory transfer group must contain one balanced OUT/IN pair' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "inventory_movements_transfer_pair"
AFTER INSERT ON "inventory_movements"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW WHEN (NEW."transfer_group_id" IS NOT NULL)
EXECUTE FUNCTION inventory_validate_transfer_pair();
