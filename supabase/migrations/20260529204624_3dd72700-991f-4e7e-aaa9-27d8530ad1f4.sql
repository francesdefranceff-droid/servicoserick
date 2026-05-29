DROP POLICY IF EXISTS "Public read debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins read debug-uploads" ON storage.objects;

UPDATE storage.buckets
SET public = true,
    file_size_limit = 500000000,
    allowed_mime_types = NULL
WHERE id = 'debug-uploads';