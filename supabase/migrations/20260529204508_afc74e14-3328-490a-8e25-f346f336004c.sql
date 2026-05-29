INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('debug-uploads', 'debug-uploads', true, 500000000, NULL)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 500000000,
    allowed_mime_types = NULL;

DROP POLICY IF EXISTS "Anyone can read debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public read debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins read debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload to debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update debug-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete debug-uploads" ON storage.objects;

CREATE POLICY "Public read debug-uploads"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'debug-uploads');

CREATE POLICY "Admins can upload to debug-uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'debug-uploads'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update debug-uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'debug-uploads'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'debug-uploads'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete debug-uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'debug-uploads'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);