ALTER TABLE public.ad_daily_stats ADD COLUMN IF NOT EXISTS dismisses integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.ad_record_event(_ad_id uuid, _event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym uuid;
  _today date;
  _enabled boolean;
  _fill boolean;
  _is_platform boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  _gym := public.current_gym_id();
  IF _gym IS NULL OR _ad_id IS NULL THEN RETURN; END IF;
  IF _event NOT IN ('impression','click','dismiss') THEN RETURN; END IF;
  IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer') THEN RETURN; END IF;

  SELECT (now() AT TIME ZONE g.timezone)::date INTO _today
    FROM public.gyms g WHERE g.id = _gym AND g.is_enabled;
  IF _today IS NULL THEN RETURN; END IF;

  SELECT s.ads_enabled, s.allow_platform_fill INTO _enabled, _fill
    FROM public.gym_ad_settings s WHERE s.gym_id = _gym;
  IF COALESCE(_enabled, false) = false THEN RETURN; END IF;

  SELECT (a.gym_id IS NULL) INTO _is_platform
  FROM public.ads a
  WHERE a.id = _ad_id AND a.status = 'active'
    AND (a.gym_id = _gym OR a.gym_id IS NULL)
    AND _today >= a.starts_on
    AND (a.ends_on IS NULL OR _today <= a.ends_on);
  IF _is_platform IS NULL THEN RETURN; END IF;

  IF _is_platform THEN
    IF COALESCE(_fill, false) = false THEN RETURN; END IF;
    IF EXISTS (SELECT 1 FROM public.gym_ad_blocklist b WHERE b.gym_id = _gym AND b.ad_id = _ad_id)
    THEN RETURN; END IF;
  END IF;

  INSERT INTO public.ad_daily_stats AS s (ad_id, gym_id, day, impressions, clicks, dismisses)
  VALUES (_ad_id, _gym, _today,
          CASE WHEN _event = 'impression' THEN 1 ELSE 0 END,
          CASE WHEN _event = 'click' THEN 1 ELSE 0 END,
          CASE WHEN _event = 'dismiss' THEN 1 ELSE 0 END)
  ON CONFLICT (ad_id, gym_id, day) DO UPDATE
    SET impressions = s.impressions + CASE WHEN _event = 'impression' THEN 1 ELSE 0 END,
        clicks      = s.clicks      + CASE WHEN _event = 'click' THEN 1 ELSE 0 END,
        dismisses   = s.dismisses   + CASE WHEN _event = 'dismiss' THEN 1 ELSE 0 END;
EXCEPTION WHEN others THEN
  RETURN;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ad_record_event(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ad_record_event(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ad_record_event(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_ad_dismisses(_days int DEFAULT 30)
RETURNS TABLE (ad_id uuid, dismisses bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym uuid;
  _since date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  _gym := public.current_gym_id();
  IF _gym IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT (now() AT TIME ZONE g.timezone)::date - (GREATEST(1, LEAST(COALESCE(_days,30), 365)) - 1)
    INTO _since FROM public.gyms g WHERE g.id = _gym;
  RETURN QUERY
  SELECT s.ad_id, COALESCE(SUM(s.dismisses),0)::bigint
  FROM public.ad_daily_stats s
  WHERE s.gym_id = _gym AND s.day >= _since
  GROUP BY s.ad_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.gym_ad_dismisses(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gym_ad_dismisses(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.gym_ad_dismisses(int) TO authenticated;