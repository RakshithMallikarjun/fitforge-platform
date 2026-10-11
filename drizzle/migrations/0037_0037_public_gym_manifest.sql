-- Public, non-sensitive branding needed for the install manifest (name, colour, logo only).
CREATE OR REPLACE FUNCTION public.public_gym_manifest(_slug text, _domain text)
RETURNS TABLE(name text, primary_color text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.name, g.primary_color, g.logo_url
  FROM public.gyms g
  WHERE g.is_enabled
    AND ((_slug IS NOT NULL AND g.slug = lower(_slug))
      OR (_domain IS NOT NULL AND lower(g.custom_domain) = lower(_domain)))
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.public_gym_manifest(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_gym_manifest(text, text) TO anon, authenticated;