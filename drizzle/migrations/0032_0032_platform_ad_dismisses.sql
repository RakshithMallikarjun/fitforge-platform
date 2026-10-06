CREATE OR REPLACE FUNCTION public.platform_ad_dismisses(_days int DEFAULT 30)
RETURNS TABLE (ad_id uuid, dismisses bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.ad_id, COALESCE(SUM(s.dismisses),0)::bigint
  FROM public.ad_daily_stats s JOIN public.ads a ON a.id = s.ad_id AND a.gym_id IS NULL
  WHERE s.day >= current_date - (GREATEST(1, LEAST(COALESCE(_days,30), 365)) - 1)
  GROUP BY s.ad_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.platform_ad_dismisses(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_ad_dismisses(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_ad_dismisses(int) TO authenticated;