-- Public contact details for the "account paused" notice on /auth (public fields only).
CREATE OR REPLACE FUNCTION public.public_gym_pause_notice(_slug text)
RETURNS TABLE(gym_name text, is_enabled boolean, support_email text, support_phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.name, g.is_enabled, g.support_email, g.support_phone
  FROM public.gyms g WHERE g.slug = lower(trim(_slug)) LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.public_gym_pause_notice(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_gym_pause_notice(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.my_gym_pause_info();
CREATE FUNCTION public.my_gym_pause_info()
RETURNS TABLE(is_enabled boolean, gym_name text, support_email text, support_phone text, gym_slug text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.is_enabled, g.name, g.support_email, g.support_phone, g.slug
    FROM public.users u JOIN public.gyms g ON g.id = u.gym_id
    WHERE u.id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.my_gym_pause_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_gym_pause_info() TO authenticated;