-- Defense in depth for the server-side API boundary.
--
-- Easyvet does not expose public application tables to browser roles. Prisma's
-- production connection is still the privileged server boundary and is
-- intentionally observed as postgres/BYPASSRLS. RLS here prevents future
-- grants from silently making application tables readable by client roles.
-- The veterinary policy exists only in the ephemeral CI database, where that
-- role exercises the API without bypassing RLS.
DO $$
DECLARE
  table_record record;
  has_veterinary boolean;
  has_anon boolean;
  has_authenticated boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'veterinary')
    INTO has_veterinary;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    INTO has_anon;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    INTO has_authenticated;

  FOR table_record IN
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.relname);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_record.relname);

    IF has_veterinary THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS easyvet_ci_runtime ON public.%I',
        table_record.relname
      );
      EXECUTE format(
        'CREATE POLICY easyvet_ci_runtime ON public.%I FOR ALL TO veterinary USING (true) WITH CHECK (true)',
        table_record.relname
      );
    END IF;

    IF has_anon THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS easyvet_deny_anon ON public.%I',
        table_record.relname
      );
      EXECUTE format(
        'CREATE POLICY easyvet_deny_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
        table_record.relname
      );
    END IF;

    IF has_authenticated THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS easyvet_deny_authenticated ON public.%I',
        table_record.relname
      );
      EXECUTE format(
        'CREATE POLICY easyvet_deny_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
        table_record.relname
      );
    END IF;
  END LOOP;
END;
$$;
