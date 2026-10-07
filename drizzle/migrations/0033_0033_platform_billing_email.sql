CREATE OR REPLACE FUNCTION public.platform_set_billing_email(_gym_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := NULLIF(lower(trim(_email)), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF _clean IS NOT NULL AND (_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_clean) > 255) THEN
    RAISE EXCEPTION 'Enter a valid billing email';
  END IF;
  UPDATE public.gyms SET billing_email = _clean WHERE id = _gym_id;
  INSERT INTO public.platform_audit_log (actor_id, action, gym_id, detail)
  VALUES (auth.uid(), 'gym.billing_email', _gym_id, jsonb_build_object('billing_email', _clean));
END; $$;
REVOKE EXECUTE ON FUNCTION public.platform_set_billing_email(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_set_billing_email(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_set_billing_email(uuid, text) TO authenticated;