-- Easyvet Supabase access audit — read-only; safe to run in the SQL Editor.
-- Run every SELECT and share the result grids, not credentials or application rows.
-- This inspects catalog metadata only. It does not enable RLS, grant, revoke, or alter anything.
-- The current_user shown below is the SQL Editor's connection role, not necessarily Vercel's
-- Prisma role; verify that runtime role separately without sharing its connection string.

-- 1. Public tables/views: RLS state, ownership, and direct client-role access.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  c.relkind AS object_kind,
  pg_get_userbyid(c.relowner) AS owner_role,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  CASE
    WHEN anon.oid IS NULL THEN NULL
    ELSE has_table_privilege(anon.oid, c.oid, 'SELECT')
  END AS anon_can_select,
  CASE
    WHEN anon.oid IS NULL THEN NULL
    ELSE has_table_privilege(anon.oid, c.oid, 'INSERT')
  END AS anon_can_insert,
  CASE
    WHEN anon.oid IS NULL THEN NULL
    ELSE has_table_privilege(anon.oid, c.oid, 'UPDATE')
  END AS anon_can_update,
  CASE
    WHEN anon.oid IS NULL THEN NULL
    ELSE has_table_privilege(anon.oid, c.oid, 'DELETE')
  END AS anon_can_delete,
  CASE
    WHEN authenticated.oid IS NULL THEN NULL
    ELSE has_table_privilege(authenticated.oid, c.oid, 'SELECT')
  END AS authenticated_can_select,
  CASE
    WHEN authenticated.oid IS NULL THEN NULL
    ELSE has_table_privilege(authenticated.oid, c.oid, 'INSERT')
  END AS authenticated_can_insert,
  CASE
    WHEN authenticated.oid IS NULL THEN NULL
    ELSE has_table_privilege(authenticated.oid, c.oid, 'UPDATE')
  END AS authenticated_can_update,
  CASE
    WHEN authenticated.oid IS NULL THEN NULL
    ELSE has_table_privilege(authenticated.oid, c.oid, 'DELETE')
  END AS authenticated_can_delete,
  CASE
    WHEN service_role.oid IS NULL THEN NULL
    ELSE has_table_privilege(service_role.oid, c.oid, 'SELECT')
  END AS service_role_can_select
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_roles AS anon ON anon.rolname = 'anon'
LEFT JOIN pg_roles AS authenticated ON authenticated.rolname = 'authenticated'
LEFT JOIN pg_roles AS service_role ON service_role.rolname = 'service_role'
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY c.relkind, c.relname;

-- 2. Policies currently attached to application tables and the Realtime private-channel table.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname IN ('public', 'realtime')
ORDER BY schemaname, tablename, policyname;

-- 3. Explicit table and sequence grants to Supabase API roles.
SELECT
  grantor,
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY grantee, table_name, privilege_type;

SELECT
  grantor,
  grantee,
  routine_schema,
  routine_name,
  privilege_type,
  is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY grantee, object_name, privilege_type;

-- 4. Role attributes. Current connection role is relevant to Prisma's RLS behavior.
SELECT
  rolname,
  rolsuper,
  rolbypassrls,
  rolinherit,
  rolcanlogin,
  (rolname = current_user) AS is_current_connection_role
FROM pg_roles
WHERE rolname IN (current_user, 'postgres', 'anon', 'authenticated', 'service_role')
ORDER BY is_current_connection_role DESC, rolname;

-- 5. Default privileges that can affect tables created by future migrations.
SELECT
  creator.rolname AS creator_role,
  COALESCE(schema_name.nspname, '<all schemas>') AS schema_name,
  COALESCE(grantee.rolname, 'PUBLIC') AS grantee_role,
  acl.privilege_type,
  acl.is_grantable
FROM pg_default_acl AS defaults
JOIN pg_roles AS creator ON creator.oid = defaults.defaclrole
LEFT JOIN pg_namespace AS schema_name ON schema_name.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS acl
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE (schema_name.nspname = 'public' OR defaults.defaclnamespace = 0)
  AND (grantee.rolname IN ('anon', 'authenticated', 'service_role') OR acl.grantee = 0)
ORDER BY creator_role, grantee_role, acl.privilege_type;

-- 6. Public-schema usage grants, which gate access to its objects.
SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.schema_privileges
WHERE schema_name = 'public'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;
