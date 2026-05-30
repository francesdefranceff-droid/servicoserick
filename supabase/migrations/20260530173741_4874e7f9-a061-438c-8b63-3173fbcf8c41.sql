CREATE TABLE public.live_streams (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL,
  avatar_url text,
  started_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_streams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.live_streams TO authenticated;
GRANT ALL ON public.live_streams TO service_role;

ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Live streams viewable by everyone"
ON public.live_streams FOR SELECT
USING (true);

CREATE POLICY "Users can start their own live"
ON public.live_streams FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own live"
ON public.live_streams FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can stop their own live"
ON public.live_streams FOR DELETE TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER TABLE public.live_streams REPLICA IDENTITY FULL;