-- ============ 0014 sponsor ads ============
DO $$ BEGIN
  CREATE TYPE public.ad_placement AS ENUM ('home_feed','workout_complete','checkin_success');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ad_status AS ENUM ('draft','active','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- ads ----------
CREATE TABLE IF NOT EXISTS public.ads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid REFERENCES public.gyms(id) ON DELETE CASCADE, -- NULL = platform campaign
  advertiser_name text NOT NULL,
  headline        text NOT NULL CHECK (char_length(headline) <= 60),
  body            text CHECK (body IS NULL OR char_length(body) <= 160),
  image_path      text,
  cta_label       text CHECK (cta_label IS NULL OR char_length(cta_label) <= 24),
  cta_url         text CHECK (cta_url IS NULL OR cta_url ~* '^https://'),
  placement       public.ad_placement NOT NULL DEFAULT 'home_feed',
  status          public.ad_status NOT NULL DEFAULT 'draft',
  starts_on       date NOT NULL,
  ends_on         date,
  priority        int NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS ads_serve_idx ON public.ads (gym_id, placement, status, starts_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ads_staff_read ON public.ads;
CREATE POLICY ads_staff_read ON public.ads FOR SELECT TO authenticated
USING (
  (gym_id = public.current_gym_id()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')))
  OR (gym_id IS NULL AND (public.is_platform_admin() OR public.has_role(auth.uid(),'admin')))
);

DROP POLICY IF EXISTS ads_gym_admin_insert ON public.ads;
CREATE POLICY ads_gym_admin_insert ON public.ads FOR INSERT TO authenticated
WITH CHECK (
  (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'))
  OR (gym_id IS NULL AND public.is_platform_admin())
);

DROP POLICY IF EXISTS ads_gym_admin_update ON public.ads;
CREATE POLICY ads_gym_admin_update ON public.ads FOR UPDATE TO authenticated
USING (
  (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'))
  OR (gym_id IS NULL AND public.is_platform_admin())
)
WITH CHECK (
  (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'))
  OR (gym_id IS NULL AND public.is_platform_admin())
);

DROP POLICY IF EXISTS ads_gym_admin_delete ON public.ads;
CREATE POLICY ads_gym_admin_delete ON public.ads FOR DELETE TO authenticated
USING (
  (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'))
  OR (gym_id IS NULL AND public.is_platform_admin())
);

-- ---------- gym_ad_settings ----------
CREATE TABLE IF NOT EXISTS public.gym_ad_settings (
  gym_id              uuid PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,
  ads_enabled         boolean NOT NULL DEFAULT false,
  allow_platform_fill boolean NOT NULL DEFAULT false,
  max_per_member_day  int NOT NULL DEFAULT 3 CHECK (max_per_member_day BETWEEN 0 AND 10),
  revenue_note        text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gym_ad_settings TO authenticated;
GRANT ALL ON public.gym_ad_settings TO service_role;
ALTER TABLE public.gym_ad_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gym_ad_settings_read ON public.gym_ad_settings;
CREATE POLICY gym_ad_settings_read ON public.gym_ad_settings FOR SELECT TO authenticated
USING (gym_id = public.current_gym_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS gym_ad_settings_insert ON public.gym_ad_settings;
CREATE POLICY gym_ad_settings_insert ON public.gym_ad_settings FOR INSERT TO authenticated
WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS gym_ad_settings_update ON public.gym_ad_settings;
CREATE POLICY gym_ad_settings_update ON public.gym_ad_settings FOR UPDATE TO authenticated
USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'))
WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'));

-- ---------- gym_ad_blocklist ----------
CREATE TABLE IF NOT EXISTS public.gym_ad_blocklist (
  gym_id     uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  ad_id      uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gym_id, ad_id)
);
GRANT SELECT, INSERT, DELETE ON public.gym_ad_blocklist TO authenticated;
GRANT ALL ON public.gym_ad_blocklist TO service_role;
ALTER TABLE public.gym_ad_blocklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gym_ad_blocklist_rw ON public.gym_ad_blocklist;
CREATE POLICY gym_ad_blocklist_rw ON public.gym_ad_blocklist FOR ALL TO authenticated
USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'))
WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'));

-- ---------- ad_daily_stats (aggregate only; NO member identity) ----------
CREATE TABLE IF NOT EXISTS public.ad_daily_stats (
  ad_id       uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  gym_id      uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  day         date NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  clicks      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (ad_id, gym_id, day)
);
GRANT ALL ON public.ad_daily_stats TO service_role;
ALTER TABLE public.ad_daily_stats ENABLE ROW LEVEL SECURITY;
-- Intentionally no policy: reachable only through the SECURITY DEFINER RPCs below.

-- ============ serving ============
CREATE OR REPLACE FUNCTION public.ad_serve(_placement public.ad_placement, _limit int DEFAULT 1)
RETURNS TABLE (id uuid, advertiser_name text, headline text, body text, image_path text,
               cta_label text, cta_url text, is_platform boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym uuid := public.current_gym_id();
  _today date;
  _enabled boolean;
  _fill boolean;
  _n int := GREATEST(1, LEAST(COALESCE(_limit, 1), 5));
  _found int := 0;
BEGIN
  IF _gym IS NULL THEN RETURN; END IF;

  -- 1. staff never see ads
  IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer') THEN
    RETURN;
  END IF;

  -- 2. gym must be enabled and opted in
  SELECT (now() AT TIME ZONE g.timezone)::date INTO _today
    FROM public.gyms g WHERE g.id = _gym AND g.is_enabled;
  IF _today IS NULL THEN RETURN; END IF;

  SELECT s.ads_enabled, s.allow_platform_fill INTO _enabled, _fill
    FROM public.gym_ad_settings s WHERE s.gym_id = _gym;
  IF COALESCE(_enabled, false) = false THEN RETURN; END IF;

  -- 3. TODO(feature C): when membership_plans.hides_ads exists, return zero rows
  --    for members on an active ad-free plan. The column does not exist yet.

  -- 4. the gym's own inventory always wins
  RETURN QUERY
  SELECT a.id, a.advertiser_name, a.headline, a.body, a.image_path,
         a.cta_label, a.cta_url, false
  FROM public.ads a
  WHERE a.gym_id = _gym
    AND a.status = 'active'
    AND a.placement = _placement
    AND _today >= a.starts_on
    AND (a.ends_on IS NULL OR _today <= a.ends_on)
  ORDER BY a.priority DESC, random()
  LIMIT _n;

  GET DIAGNOSTICS _found = ROW_COUNT;
  IF _found > 0 OR COALESCE(_fill, false) = false THEN RETURN; END IF;

  -- 5. platform backfill, never mixed with gym inventory
  RETURN QUERY
  SELECT a.id, a.advertiser_name, a.headline, a.body, a.image_path,
         a.cta_label, a.cta_url, true
  FROM public.ads a
  WHERE a.gym_id IS NULL
    AND a.status = 'active'
    AND a.placement = _placement
    AND _today >= a.starts_on
    AND (a.ends_on IS NULL OR _today <= a.ends_on)
    AND NOT EXISTS (
      SELECT 1 FROM public.gym_ad_blocklist b WHERE b.gym_id = _gym AND b.ad_id = a.id
    )
  ORDER BY a.priority DESC, random()
  LIMIT _n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ad_serve(public.ad_placement, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ad_serve(public.ad_placement, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.ad_serve(public.ad_placement, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ad_record_event(_ad_id uuid, _event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym uuid := public.current_gym_id();
  _today date;
  _enabled boolean;
  _fill boolean;
  _is_platform boolean;
  _ok boolean := false;
BEGIN
  IF _gym IS NULL OR _ad_id IS NULL THEN RETURN; END IF;
  IF _event NOT IN ('impression','click') THEN RETURN; END IF;
  IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer') THEN RETURN; END IF;

  SELECT (now() AT TIME ZONE g.timezone)::date INTO _today
    FROM public.gyms g WHERE g.id = _gym AND g.is_enabled;
  IF _today IS NULL THEN RETURN; END IF;

  SELECT s.ads_enabled, s.allow_platform_fill INTO _enabled, _fill
    FROM public.gym_ad_settings s WHERE s.gym_id = _gym;
  IF COALESCE(_enabled, false) = false THEN RETURN; END IF;

  -- re-verify eligibility instead of trusting the id from the client
  SELECT (a.gym_id IS NULL) INTO _is_platform
  FROM public.ads a
  WHERE a.id = _ad_id
    AND a.status = 'active'
    AND (a.gym_id = _gym OR a.gym_id IS NULL)
    AND _today >= a.starts_on
    AND (a.ends_on IS NULL OR _today <= a.ends_on);
  IF _is_platform IS NULL THEN RETURN; END IF;

  IF _is_platform THEN
    IF COALESCE(_fill, false) = false THEN RETURN; END IF;
    IF EXISTS (SELECT 1 FROM public.gym_ad_blocklist b WHERE b.gym_id = _gym AND b.ad_id = _ad_id)
    THEN RETURN; END IF;
  END IF;
  _ok := true;

  IF _ok THEN
    INSERT INTO public.ad_daily_stats AS s (ad_id, gym_id, day, impressions, clicks)
    VALUES (_ad_id, _gym, _today,
            CASE WHEN _event = 'impression' THEN 1 ELSE 0 END,
            CASE WHEN _event = 'click' THEN 1 ELSE 0 END)
    ON CONFLICT (ad_id, gym_id, day) DO UPDATE
      SET impressions = s.impressions + CASE WHEN _event = 'impression' THEN 1 ELSE 0 END,
          clicks      = s.clicks      + CASE WHEN _event = 'click' THEN 1 ELSE 0 END;
  END IF;
EXCEPTION WHEN others THEN
  RETURN; -- never surface an error into the member UI
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ad_record_event(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ad_record_event(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ad_record_event(uuid, text) TO authenticated;

-- ============ reporting ============
CREATE OR REPLACE FUNCTION public.gym_ad_report(_days int DEFAULT 30)
RETURNS TABLE (ad_id uuid, advertiser_name text, headline text, placement public.ad_placement,
               status public.ad_status, starts_on date, ends_on date,
               impressions bigint, clicks bigint, ctr numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym uuid := public.current_gym_id();
  _since date;
BEGIN
  IF _gym IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT (now() AT TIME ZONE g.timezone)::date - (GREATEST(1, LEAST(COALESCE(_days,30), 365)) - 1)
    INTO _since FROM public.gyms g WHERE g.id = _gym;

  RETURN QUERY
  SELECT a.id, a.advertiser_name, a.headline, a.placement, a.status, a.starts_on, a.ends_on,
         COALESCE(SUM(s.impressions), 0)::bigint,
         COALESCE(SUM(s.clicks), 0)::bigint,
         ROUND(100.0 * COALESCE(SUM(s.clicks),0) / NULLIF(COALESCE(SUM(s.impressions),0), 0), 2)
  FROM public.ads a
  LEFT JOIN public.ad_daily_stats s
    ON s.ad_id = a.id AND s.gym_id = _gym AND s.day >= _since
  WHERE a.gym_id = _gym
  GROUP BY a.id, a.advertiser_name, a.headline, a.placement, a.status, a.starts_on, a.ends_on
  ORDER BY a.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.gym_ad_report(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gym_ad_report(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.gym_ad_report(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_ad_daily(_days int DEFAULT 30)
RETURNS TABLE (day date, impressions bigint, clicks bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym uuid := public.current_gym_id();
  _today date;
  _n int := GREATEST(1, LEAST(COALESCE(_days,30), 365));
BEGIN
  IF _gym IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT (now() AT TIME ZONE g.timezone)::date INTO _today FROM public.gyms g WHERE g.id = _gym;

  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day FROM generate_series(_today - (_n - 1), _today, interval '1 day') d
  )
  SELECT d.day,
         COALESCE(SUM(s.impressions), 0)::bigint,
         COALESCE(SUM(s.clicks), 0)::bigint
  FROM days d
  LEFT JOIN public.ad_daily_stats s ON s.day = d.day AND s.gym_id = _gym
  GROUP BY d.day ORDER BY d.day;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.gym_ad_daily(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gym_ad_daily(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.gym_ad_daily(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_ad_report(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _since date := current_date - (GREATEST(1, LEAST(COALESCE(_days,30), 365)) - 1);
  _result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'campaigns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ad_id', a.id, 'advertiser_name', a.advertiser_name, 'headline', a.headline,
        'placement', a.placement, 'status', a.status,
        'starts_on', a.starts_on, 'ends_on', a.ends_on,
        'impressions', t.impressions, 'clicks', t.clicks,
        'gyms_served', t.gyms_served,
        'by_gym', t.by_gym
      ) ORDER BY a.created_at DESC)
      FROM public.ads a
      CROSS JOIN LATERAL (
        SELECT COALESCE(SUM(s.impressions),0)::bigint AS impressions,
               COALESCE(SUM(s.clicks),0)::bigint AS clicks,
               COUNT(DISTINCT s.gym_id)::int AS gyms_served,
               COALESCE(jsonb_agg(jsonb_build_object(
                 'gym_id', s.gym_id, 'gym_name', g.name,
                 'impressions', s.impressions, 'clicks', s.clicks)) FILTER (WHERE s.ad_id IS NOT NULL), '[]'::jsonb) AS by_gym
        FROM public.ad_daily_stats s
        LEFT JOIN public.gyms g ON g.id = s.gym_id
        WHERE s.ad_id = a.id AND s.day >= _since
      ) t
      WHERE a.gym_id IS NULL
    ), '[]'::jsonb),
    'gyms', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'gym_id', g.id, 'gym_name', g.name, 'slug', g.slug, 'is_enabled', g.is_enabled,
        'ads_enabled', COALESCE(s.ads_enabled, false),
        'allow_platform_fill', COALESCE(s.allow_platform_fill, false),
        'max_per_member_day', COALESCE(s.max_per_member_day, 3),
        'revenue_note', s.revenue_note,
        'member_count', (SELECT count(*) FROM public.user_roles r
                          WHERE r.gym_id = g.id AND r.role = 'member')
      ) ORDER BY g.name)
      FROM public.gyms g LEFT JOIN public.gym_ad_settings s ON s.gym_id = g.id
    ), '[]'::jsonb),
    'fill_enabled_gyms', (SELECT count(*) FROM public.gym_ad_settings
                           WHERE ads_enabled AND allow_platform_fill)
  ) INTO _result;

  RETURN _result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_ad_report(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_ad_report(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_ad_report(int) TO authenticated;

-- Platform-visible inventory for a gym admin deciding what to block.
CREATE OR REPLACE FUNCTION public.platform_ads_for_gym()
RETURNS TABLE (id uuid, advertiser_name text, headline text, body text, image_path text,
               cta_label text, cta_url text, placement public.ad_placement,
               starts_on date, ends_on date, blocked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _gym uuid := public.current_gym_id();
BEGIN
  IF _gym IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.id, a.advertiser_name, a.headline, a.body, a.image_path, a.cta_label, a.cta_url,
         a.placement, a.starts_on, a.ends_on,
         EXISTS (SELECT 1 FROM public.gym_ad_blocklist b WHERE b.gym_id = _gym AND b.ad_id = a.id)
  FROM public.ads a
  WHERE a.gym_id IS NULL AND a.status IN ('active','paused')
  ORDER BY a.advertiser_name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_ads_for_gym() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_ads_for_gym() FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_ads_for_gym() TO authenticated;

-- Platform operator records the (manual) revenue-share note per gym.
CREATE OR REPLACE FUNCTION public.platform_set_gym_ad_note(_gym_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.gym_ad_settings (gym_id, revenue_note, updated_at)
  VALUES (_gym_id, NULLIF(btrim(COALESCE(_note,'')), ''), now())
  ON CONFLICT (gym_id) DO UPDATE
    SET revenue_note = NULLIF(btrim(COALESCE(_note,'')), ''), updated_at = now();

  INSERT INTO public.platform_audit_log (actor_id, action, gym_id, detail)
  VALUES (auth.uid(), 'set_gym_ad_note', _gym_id, jsonb_build_object('note', _note));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_set_gym_ad_note(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_set_gym_ad_note(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_set_gym_ad_note(uuid, text) TO authenticated;
