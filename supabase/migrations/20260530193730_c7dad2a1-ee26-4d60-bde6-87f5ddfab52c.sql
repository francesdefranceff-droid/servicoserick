
-- Allow authenticated users to upload to and read their debug-uploads
DROP POLICY IF EXISTS "Authenticated can upload debug-uploads" ON storage.objects;
CREATE POLICY "Authenticated can upload debug-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'debug-uploads');

DROP POLICY IF EXISTS "Authenticated can read debug-uploads" ON storage.objects;
CREATE POLICY "Authenticated can read debug-uploads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'debug-uploads');
