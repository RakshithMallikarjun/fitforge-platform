-- Audit trail for platform-side sponsor-ad writes.
CREATE OR REPLACE FUNCTION public.platform_audit_ad(_ad_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _detail jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF _action NOT IN ('create_platform_ad', 'update_platform_ad', 'set_platform_ad_status',
                     'delete_platform_ad') THEN
    RAISE EXCEPTION 'Unknown ad action: %', COALESCE(_action, '(none)');
  END IF;

  SELECT jsonb_build_object(
           'ad_id', a.id, 'advertiser_name', a.advertiser_name, 'headline', a.headline,
           'placement', a.placement, 'status', a.status,
           'starts_on', a.starts_on, 'ends_on', a.ends_on, 'priority', a.priority)
    INTO _detail
    FROM public.ads a WHERE a.id = _ad_id AND a.gym_id IS NULL;

  INSERT INTO public.platform_audit_log (actor_id, action, gym_id, detail)
  VALUES (auth.uid(), _action, NULL,
          COALESCE(_detail, jsonb_build_object('ad_id', _ad_id)));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.platform_audit_ad(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_audit_ad(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_audit_ad(uuid, text) TO authenticated;
