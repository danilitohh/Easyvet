-- Runtime database role for Production.
--
-- The password is intentionally not stored in a migration. Production receives
-- it through Vercel's encrypted DATABASE_URL environment variable. This keeps
-- credential rotation outside Git while making role attributes, grants and RLS
-- posture reproducible in every database.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'veterinary') THEN
    ALTER ROLE veterinary
      WITH LOGIN
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        NOINHERIT
        NOREPLICATION
        NOBYPASSRLS;
  ELSE
    CREATE ROLE veterinary
      LOGIN
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        NOINHERIT
        NOREPLICATION
        NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO veterinary;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO veterinary;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO veterinary;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO veterinary;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO veterinary;

-- Every application table remains forced through RLS. The API remains the
-- authorization boundary; this policy prevents the runtime role from using
-- PostgreSQL's BYPASSRLS capability and keeps the existing server-side tenant
-- filters intact. A future migration must add a matching policy for new tables.
DO $$
DECLARE
  table_record record;
BEGIN
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
    EXECUTE format(
      'DROP POLICY IF EXISTS easyvet_runtime_server ON public.%I',
      table_record.relname
    );
    EXECUTE format(
      'CREATE POLICY easyvet_runtime_server ON public.%I FOR ALL TO veterinary USING (true) WITH CHECK (true)',
      table_record.relname
    );
  END LOOP;
END
$$;
