-- Additive and idempotent: existing objects and unrelated buckets are never modified or deleted.
-- Storage remains private; only the server-side service-role adapter accesses this bucket.
DO $$
BEGIN
  -- Plain local PostgreSQL development databases do not install Supabase Storage.
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
  VALUES (
    'easyvet-clinical-documents',
    'easyvet-clinical-documents',
    false,
    10485760,
    ARRAY['application/pdf', 'image/png', 'image/jpeg']::text[]
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
END;
$$;
