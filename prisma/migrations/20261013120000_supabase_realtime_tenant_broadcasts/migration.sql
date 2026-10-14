-- Broadcast only tenant-scoped invalidation metadata; never stream clinical row contents.
-- Trigger installation is conditional so local PostgreSQL without Supabase Realtime remains usable.
CREATE OR REPLACE FUNCTION public.easyvet_broadcast_organization_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_organization_id uuid;
  new_organization_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_organization_id := OLD.organization_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_organization_id := NEW.organization_id;
  END IF;

  IF old_organization_id IS NOT NULL THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING pg_catalog.jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
        'tenant_data_changed',
        'easyvet:org:' || old_organization_id::text,
        true;
  END IF;

  IF new_organization_id IS NOT NULL AND new_organization_id IS DISTINCT FROM old_organization_id THEN
    EXECUTE 'SELECT realtime.send($1, $2, $3, $4)'
      USING pg_catalog.jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
        'tenant_data_changed',
        'easyvet:org:' || new_organization_id::text,
        true;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tenant_table record;
BEGIN
  IF pg_catalog.to_regclass('realtime.messages') IS NULL
     OR pg_catalog.to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS easyvet_receive_organization_broadcasts ON realtime.messages';
  EXECUTE $policy$
    CREATE POLICY easyvet_receive_organization_broadcasts
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      extension = 'broadcast'
      AND realtime.topic() = 'easyvet:org:' || ((SELECT auth.jwt()) ->> 'organization_id')
    )
  $policy$;

  FOR tenant_table IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'organization_id'
    GROUP BY table_schema, table_name
  LOOP
    EXECUTE pg_catalog.format(
      'DROP TRIGGER IF EXISTS easyvet_realtime_organization_change ON %I.%I',
      tenant_table.table_schema,
      tenant_table.table_name
    );
    EXECUTE pg_catalog.format(
      'CREATE TRIGGER easyvet_realtime_organization_change\n'
      'AFTER INSERT OR UPDATE OR DELETE ON %I.%I\n'
      'FOR EACH ROW EXECUTE FUNCTION public.easyvet_broadcast_organization_change()',
      tenant_table.table_schema,
      tenant_table.table_name
    );
  END LOOP;
END;
$$;
