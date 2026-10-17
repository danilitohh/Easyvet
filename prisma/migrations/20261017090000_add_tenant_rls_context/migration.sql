-- Bind the non-bypass runtime role to the organization selected by the
-- server-side tenant guard. The application sets these values transaction
-- locally before every Prisma model operation; no browser value is trusted.
DO $$
DECLARE
  table_record record;
  tenant_expression text;
BEGIN
  FOR table_record IN
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> '_prisma_migrations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS easyvet_runtime_server ON public.%I', table_record.relname);
    EXECUTE format('DROP POLICY IF EXISTS easyvet_ci_runtime ON public.%I', table_record.relname);
    EXECUTE format('DROP POLICY IF EXISTS easyvet_runtime_tenant ON public.%I', table_record.relname);

    tenant_expression := CASE table_record.relname
      WHEN 'organizations' THEN
        '(id = NULLIF(current_setting(''app.easyvet_organization_id'', true), '''')::uuid)'
      WHEN 'users' THEN
        '(EXISTS (
          SELECT 1
          FROM public.memberships AS membership
          WHERE membership.user_id = id
            AND membership.organization_id = NULLIF(current_setting(''app.easyvet_organization_id'', true), '''')::uuid
        ))'
      WHEN 'sessions' THEN
        'false'
      WHEN 'api_rate_limit_buckets' THEN
        'false'
      WHEN 'subscription_plans' THEN
        '(current_setting(''app.easyvet_context'', true) IN (''system'', ''tenant''))'
      WHEN 'prescription_items' THEN
        '(EXISTS (
          SELECT 1
          FROM public.prescriptions AS prescription
          WHERE prescription.id = prescription_id
            AND prescription.organization_id = NULLIF(current_setting(''app.easyvet_organization_id'', true), '''')::uuid
        ))'
      ELSE
        '(organization_id = NULLIF(current_setting(''app.easyvet_organization_id'', true), '''')::uuid)'
    END;

    EXECUTE format(
      'CREATE POLICY easyvet_runtime_tenant ON public.%I FOR ALL TO veterinary USING ((current_setting(''app.easyvet_context'', true) = ''system'') OR (current_setting(''app.easyvet_context'', true) = ''tenant'' AND %s)) WITH CHECK ((current_setting(''app.easyvet_context'', true) = ''system'') OR (current_setting(''app.easyvet_context'', true) = ''tenant'' AND %s))',
      table_record.relname,
      tenant_expression,
      tenant_expression
    );
  END LOOP;
END;
$$;
