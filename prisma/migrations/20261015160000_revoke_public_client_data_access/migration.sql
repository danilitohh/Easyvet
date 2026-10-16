-- Easyvet data is accessed through the authenticated NestJS/Prisma API.
-- Browser Supabase access is limited to private Realtime in the separate
-- realtime schema; client roles must not access public application tables.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- This SECURITY DEFINER trigger function is invoked by database triggers, not
-- through PostgREST RPC by browser client roles (including via PUBLIC grants).
REVOKE EXECUTE ON FUNCTION public.easyvet_broadcast_organization_change() FROM PUBLIC;

-- Prevent Prisma-created objects from reintroducing direct client grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
