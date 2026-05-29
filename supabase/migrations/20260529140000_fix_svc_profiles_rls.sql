-- Ensure svc_profiles RLS policies allow users to manage their own profile
ALTER TABLE public.svc_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own svc profile" ON public.svc_profiles;
CREATE POLICY "Users insert own svc profile"
  ON public.svc_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own svc profile" ON public.svc_profiles;
CREATE POLICY "Users update own svc profile"
  ON public.svc_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.svc_profiles;
CREATE POLICY "Profiles viewable by authenticated"
  ON public.svc_profiles FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE ON public.svc_profiles TO authenticated;
GRANT ALL ON public.svc_profiles TO service_role;
