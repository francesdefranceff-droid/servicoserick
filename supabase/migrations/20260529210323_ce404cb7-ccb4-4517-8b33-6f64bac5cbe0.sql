DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'svc_posts'
      AND policyname = 'Admins can delete any svc post'
  ) THEN
    CREATE POLICY "Admins can delete any svc post"
    ON public.svc_posts
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'svc_profiles'
      AND policyname = 'Admins can delete svc profiles'
  ) THEN
    CREATE POLICY "Admins can delete svc profiles"
    ON public.svc_profiles
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_posts TO authenticated;
GRANT ALL ON public.svc_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_profiles TO authenticated;
GRANT ALL ON public.svc_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_subscriptions TO authenticated;
GRANT ALL ON public.svc_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_conversations TO authenticated;
GRANT ALL ON public.svc_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.svc_messages TO authenticated;
GRANT ALL ON public.svc_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;