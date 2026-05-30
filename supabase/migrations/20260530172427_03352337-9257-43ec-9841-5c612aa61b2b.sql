CREATE OR REPLACE FUNCTION public.ensure_svc_category(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_clean text;
BEGIN
  v_clean := trim(_name);
  IF v_clean IS NULL OR length(v_clean) = 0 THEN
    RETURN 'outros';
  END IF;

  -- generate slug: lowercase, replace non-alnum with -, trim dashes
  v_slug := lower(v_clean);
  v_slug := translate(v_slug,
    'áàâãäåéèêëíìîïóòôõöúùûüçñ',
    'aaaaaaeeeeiiiiooooouuuucn');
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  IF v_slug = '' THEN v_slug := 'outros'; END IF;

  INSERT INTO public.svc_categories (slug, name)
  VALUES (v_slug, v_clean)
  ON CONFLICT (slug) DO NOTHING;

  RETURN v_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_svc_category(text) TO authenticated, anon;