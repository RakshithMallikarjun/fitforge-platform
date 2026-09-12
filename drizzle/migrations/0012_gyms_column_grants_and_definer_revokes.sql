REVOKE ALL ON public.gyms FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  slug,
  logo_url,
  primary_color,
  secondary_color,
  font_family,
  timezone,
  support_email,
  support_phone,
  custom_domain,
  is_enabled,
  created_at
) ON public.gyms TO authenticated;

GRANT UPDATE (
  name,
  primary_color,
  secondary_color,
  logo_url,
  font_family,
  support_email,
  support_phone,
  timezone,
  custom_domain
) ON public.gyms TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_join_code(text, text) FROM PUBLIC, anon, authenticated;