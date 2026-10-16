-- The browser talks to the NestJS API; Supabase client roles must not resolve
-- objects in the application's public schema. Keep service_role for server-side
-- Supabase Realtime compatibility and postgres as the Prisma/migration owner.
REVOKE USAGE ON SCHEMA public FROM PUBLIC;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
