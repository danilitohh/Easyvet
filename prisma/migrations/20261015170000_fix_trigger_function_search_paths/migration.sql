-- Pin trigger function name resolution to trusted schemas.
-- Application roles cannot CREATE objects in public; pg_temp is explicit and last.
ALTER FUNCTION public.inventory_reject_movement_mutation()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.inventory_reject_movement_truncate()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.inventory_guard_batch_identity()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.inventory_validate_transfer_pair()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_settings_update()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.inventory_guard_movement_insert()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_validate_inventory_sale_movement()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_sale_update()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_sale_payment()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_sale_payment_insert()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_invoice()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_invoice_insert()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_cash_session()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_cash_movement_insert()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_reject_ledger_mutation()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_validate_sale_commit()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_sale_item()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.organization_audit_events_reject_mutation()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.commercial_guard_cash_session_currency()
  SET search_path = pg_catalog, public, pg_temp;
