GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_posts TO authenticated;
GRANT ALL ON public.svc_posts TO service_role;

ALTER TABLE public.svc_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own posts" ON public.svc_posts;
CREATE POLICY "Users insert own posts"
ON public.svc_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('svc-photos', 'svc-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "svc photos public read" ON storage.objects;
CREATE POLICY "svc photos public read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'svc-photos');

DROP POLICY IF EXISTS "svc photos auth upload own" ON storage.objects;
CREATE POLICY "svc photos auth upload own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'svc-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
