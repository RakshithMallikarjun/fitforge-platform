CREATE OR REPLACE FUNCTION public.my_gym_pause_info()
RETURNS TABLE(is_enabled boolean, gym_name text, support_email text, support_phone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.is_enabled, g.name, g.support_email, g.support_phone
    FROM public.users u JOIN public.gyms g ON g.id = u.gym_id
    WHERE u.id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.my_gym_pause_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_gym_pause_info() TO authenticated;