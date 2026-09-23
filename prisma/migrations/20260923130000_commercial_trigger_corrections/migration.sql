-- Keep the product lot-tracking variable unambiguous inside PL/pgSQL trigger scope.
CREATE OR REPLACE FUNCTION commercial_guard_sale_item() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "SaleStatus";
  inventory_item_lot_tracking BOOLEAN;
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
    SELECT "lot_tracking", "status" INTO inventory_item_lot_tracking, item_status
    FROM "inventory_items"
    WHERE "id" = NEW."inventory_item_id" AND "organization_id" = NEW."organization_id" FOR UPDATE;
    IF NOT FOUND OR item_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Product sale items require an active inventory item' USING ERRCODE = '23514';
    END IF;
    IF inventory_item_lot_tracking <> (NEW."inventory_batch_id" IS NOT NULL) THEN
      RAISE EXCEPTION 'Inventory batch does not match lot tracking' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."inventory_item_id" IS NOT NULL OR NEW."inventory_batch_id" IS NOT NULL THEN
    RAISE EXCEPTION 'Only product sale items may reference inventory' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
