CREATE OR REPLACE FUNCTION public.get_or_create_own_svc_profile(
  _display_name text DEFAULT NULL,
  _avatar_url text DEFAULT NULL,
  _city text DEFAULT NULL,
  _categories text[] DEFAULT '{}'::text[]
)
RETURNS public.svc_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile public.svc_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO _profile
  FROM public.svc_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF FOUND THEN
    IF _profile.avatar_url IS NULL AND _avatar_url IS NOT NULL THEN
      UPDATE public.svc_profiles
      SET avatar_url = _avatar_url
      WHERE id = _profile.id
      RETURNING * INTO _profile;
    END IF;

    RETURN _profile;
  END IF;

  INSERT INTO public.svc_profiles (user_id, display_name, role, city, avatar_url, categories)
  VALUES (
    auth.uid(),
    COALESCE(NULLIF(_display_name, ''), 'Usuário'),
    'migrant',
    NULLIF(_city, ''),
    NULLIF(_avatar_url, ''),
    COALESCE(_categories, '{}'::text[])
  )
  RETURNING * INTO _profile;

  RETURN _profile;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_own_svc_profile(text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_own_svc_profile(text, text, text, text[]) TO authenticated, service_role;
