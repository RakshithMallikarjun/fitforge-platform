-- ============ 1.1 platform admin identity ============
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  note       text
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.platform_admins TO service_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ============ 1.2 gym enablement + billing ============
DO $$ BEGIN
  CREATE TYPE public.gym_payment_status AS ENUM ('trialing','paid','pending','overdue','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS is_enabled      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_at     timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text,
  ADD COLUMN IF NOT EXISTS payment_status  public.gym_payment_status NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS last_payment_at date,
  ADD COLUMN IF NOT EXISTS next_due_at     date,
  ADD COLUMN IF NOT EXISTS monthly_amount  numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency        text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS billing_email   text,
  ADD COLUMN IF NOT EXISTS internal_note   text;

CREATE INDEX IF NOT EXISTS gyms_enabled_idx ON public.gyms (is_enabled);
CREATE INDEX IF NOT EXISTS gyms_payment_status_idx ON public.gyms (payment_status);

-- ============ 1.3 audit log ============
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid NOT NULL REFERENCES auth.users(id),
  action     text NOT NULL,
  gym_id     uuid REFERENCES public.gyms(id) ON DELETE SET NULL,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.platform_audit_log TO service_role;

-- ============ 1.4 provisioning exception in handle_new_user ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym_id uuid;
  _gym_slug text := NEW.raw_user_meta_data ->> 'gym_slug';
  _display_name text := COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1));
BEGIN
  IF COALESCE(NEW.raw_user_meta_data ->> 'is_platform', '') = 'true' THEN
    INSERT INTO public.users (id, gym_id, email, display_name)
    VALUES (NEW.id, NULL, NEW.email, _display_name);
    RETURN NEW;
  END IF;

  IF _gym_slug IS NOT NULL THEN
    SELECT id INTO _gym_id FROM public.gyms WHERE slug = _gym_slug;
  END IF;

  IF _gym_slug IS NULL OR _gym_id IS NULL THEN
    RAISE EXCEPTION 'Unknown gym code: %', COALESCE(_gym_slug, '(none)');
  END IF;

  INSERT INTO public.users (id, gym_id, email, display_name)
  VALUES (NEW.id, _gym_id, NEW.email, _display_name);

  INSERT INTO public.user_roles (user_id, gym_id, role)
  VALUES (NEW.id, _gym_id, 'member');

  INSERT INTO public.member_profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ============ 1.8 gym enablement lookup for own gym ============
CREATE OR REPLACE FUNCTION public.my_gym_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT g.is_enabled FROM public.users u LEFT JOIN public.gyms g ON g.id = u.gym_id
      WHERE u.id = auth.uid()),
    true)
$$;
REVOKE EXECUTE ON FUNCTION public.my_gym_enabled() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_gym_enabled() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_gym_enabled() TO authenticated;

-- ============ shared activity source (gym-timezone bucketed) ============
CREATE OR REPLACE VIEW public.platform_activity_days AS
  SELECT w.gym_id, w.member_id, w.date AS day, 1 AS is_workout, 0 AS is_checkin
  FROM public.workout_logs w
  UNION ALL
  SELECT a.gym_id, a.member_id, (a.check_in_at AT TIME ZONE g.timezone)::date AS day, 0, 1
  FROM public.attendance_logs a JOIN public.gyms g ON g.id = a.gym_id;
REVOKE ALL ON public.platform_activity_days FROM PUBLIC;
REVOKE ALL ON public.platform_activity_days FROM anon;
REVOKE ALL ON public.platform_activity_days FROM authenticated;

-- ============ 1.5(a) platform_overview ============
CREATE OR REPLACE FUNCTION public.platform_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  WITH gtoday AS (SELECT id AS gym_id, (now() AT TIME ZONE timezone)::date AS today FROM public.gyms),
  act AS (
    SELECT d.*, t.today FROM public.platform_activity_days d JOIN gtoday t ON t.gym_id = d.gym_id
  ),
  roles AS (
    SELECT r.role, count(DISTINCT r.user_id) AS n FROM public.user_roles r GROUP BY r.role
  )
  SELECT jsonb_build_object(
    'total_gyms', (SELECT count(*) FROM public.gyms),
    'enabled_gyms', (SELECT count(*) FROM public.gyms WHERE is_enabled),
    'disabled_gyms', (SELECT count(*) FROM public.gyms WHERE NOT is_enabled),
    'gyms_by_payment_status', COALESCE((SELECT jsonb_object_agg(payment_status, n) FROM (SELECT payment_status, count(*) n FROM public.gyms GROUP BY 1) s), '{}'::jsonb),
    'gyms_by_plan', COALESCE((SELECT jsonb_object_agg(subscription_plan, n) FROM (SELECT subscription_plan, count(*) n FROM public.gyms GROUP BY 1) s), '{}'::jsonb),
    'total_members', COALESCE((SELECT n FROM roles WHERE role = 'member'), 0),
    'active_members', (SELECT count(DISTINCT r.user_id) FROM public.user_roles r JOIN public.users u ON u.id = r.user_id WHERE r.role = 'member' AND u.active),
    'total_trainers', COALESCE((SELECT n FROM roles WHERE role = 'trainer'), 0),
    'total_admins', COALESCE((SELECT n FROM roles WHERE role = 'admin'), 0),
    'new_gyms_30d', (SELECT count(*) FROM public.gyms WHERE created_at >= now() - interval '30 days'),
    'new_members_30d', (SELECT count(DISTINCT r.user_id) FROM public.user_roles r JOIN public.users u ON u.id = r.user_id WHERE r.role = 'member' AND u.created_at >= now() - interval '30 days'),
    'workouts_30d', (SELECT count(*) FROM act WHERE is_workout = 1 AND day > today - 30),
    'checkins_30d', (SELECT count(*) FROM act WHERE is_checkin = 1 AND day > today - 30),
    'plans_30d', (SELECT count(*) FROM public.workout_plans WHERE created_at >= now() - interval '30 days'),
    'assessments_30d', (SELECT count(*) FROM public.fitness_assessments WHERE created_at >= now() - interval '30 days'),
    'dau', (SELECT count(DISTINCT member_id) FROM act WHERE day >= today),
    'wau', (SELECT count(DISTINCT member_id) FROM act WHERE day > today - 7),
    'mau', (SELECT count(DISTINCT member_id) FROM act WHERE day > today - 30),
    'stickiness', (SELECT round((SELECT count(DISTINCT member_id) FROM act WHERE day >= today)::numeric
                     / NULLIF((SELECT count(DISTINCT member_id) FROM act WHERE day > today - 30), 0), 4)),
    'engaged_gyms_30d', (SELECT count(DISTINCT gym_id) FROM act WHERE day > today - 30),
    'at_risk_gyms', (SELECT count(*) FROM public.gyms g WHERE g.is_enabled AND NOT EXISTS (
        SELECT 1 FROM act a WHERE a.gym_id = g.id AND a.day > a.today - 14)),
    'overdue_gyms', (SELECT count(*) FROM public.gyms WHERE payment_status IN ('overdue','failed'))
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_overview() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_overview() TO authenticated;

-- ============ 1.5(b) platform_gyms ============
-- health_score: 40% active_member_ratio + 30% min(workouts_per_active_member_30d/8,1)
--             + 20% checkin_rate_30d + 10% plan_coverage.  Bands: >=70 healthy,
--             40-69 watch, <40 at risk; zero members => 0, shown as "no data".
CREATE OR REPLACE FUNCTION public.platform_gyms()
RETURNS TABLE (
  id uuid, name text, slug text, created_at timestamptz, timezone text, custom_domain text,
  subscription_plan public.subscription_plan, is_enabled boolean, disabled_at timestamptz,
  payment_status public.gym_payment_status, last_payment_at date, next_due_at date,
  monthly_amount numeric, currency text,
  member_count int, active_member_count int, trainer_count int, admin_count int,
  workouts_7d int, workouts_30d int, checkins_7d int, checkins_30d int,
  plans_30d int, assessments_30d int,
  active_member_ratio numeric, workouts_per_active_member_30d numeric,
  checkin_rate_30d numeric, plan_coverage numeric, assessed_90d_ratio numeric,
  members_per_trainer numeric, last_activity_at timestamptz, days_since_activity int,
  health_score numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH g AS (SELECT gy.*, (now() AT TIME ZONE gy.timezone)::date AS today FROM public.gyms gy),
  rc AS (
    SELECT r.gym_id,
      count(DISTINCT CASE WHEN r.role = 'member' THEN r.user_id END)::int AS member_count,
      count(DISTINCT CASE WHEN r.role = 'member' AND u.active THEN r.user_id END)::int AS active_member_count,
      count(DISTINCT CASE WHEN r.role = 'trainer' THEN r.user_id END)::int AS trainer_count,
      count(DISTINCT CASE WHEN r.role = 'admin' THEN r.user_id END)::int AS admin_count
    FROM public.user_roles r LEFT JOIN public.users u ON u.id = r.user_id
    GROUP BY r.gym_id
  ),
  a AS (SELECT d.*, gg.today FROM public.platform_activity_days d JOIN g gg ON gg.id = d.gym_id),
  ag AS (
    SELECT gym_id,
      sum(CASE WHEN is_workout = 1 AND day > today - 7 THEN 1 ELSE 0 END)::int AS workouts_7d,
      sum(CASE WHEN is_workout = 1 AND day > today - 30 THEN 1 ELSE 0 END)::int AS workouts_30d,
      sum(CASE WHEN is_checkin = 1 AND day > today - 7 THEN 1 ELSE 0 END)::int AS checkins_7d,
      sum(CASE WHEN is_checkin = 1 AND day > today - 30 THEN 1 ELSE 0 END)::int AS checkins_30d,
      count(DISTINCT CASE WHEN is_workout = 1 AND day > today - 30 THEN member_id END)::int AS workout_members_30d,
      count(DISTINCT CASE WHEN is_checkin = 1 AND day > today - 30 THEN member_id END)::int AS checkin_members_30d
    FROM a GROUP BY gym_id
  ),
  la AS (
    SELECT gym_id, max(ts) AS last_activity_at FROM (
      SELECT gym_id, COALESCE(completed_at, created_at) AS ts FROM public.workout_logs
      UNION ALL SELECT gym_id, check_in_at FROM public.attendance_logs
    ) s GROUP BY gym_id
  ),
  pl AS (
    SELECT gym_id,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS plans_30d,
      count(DISTINCT CASE WHEN status <> 'archived' THEN member_id END)::int AS planned_members
    FROM public.workout_plans GROUP BY gym_id
  ),
  asm AS (
    SELECT gym_id,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS assessments_30d,
      count(DISTINCT CASE WHEN date >= (current_date - 90) THEN member_id END)::int AS assessed_members_90d
    FROM public.fitness_assessments GROUP BY gym_id
  ),
  base AS (
    SELECT g.id, g.name, g.slug, g.created_at, g.timezone, g.custom_domain, g.subscription_plan,
      g.is_enabled, g.disabled_at, g.payment_status, g.last_payment_at, g.next_due_at,
      g.monthly_amount, g.currency, g.today,
      COALESCE(rc.member_count, 0) AS member_count,
      COALESCE(rc.active_member_count, 0) AS active_member_count,
      COALESCE(rc.trainer_count, 0) AS trainer_count,
      COALESCE(rc.admin_count, 0) AS admin_count,
      COALESCE(ag.workouts_7d, 0) AS workouts_7d, COALESCE(ag.workouts_30d, 0) AS workouts_30d,
      COALESCE(ag.checkins_7d, 0) AS checkins_7d, COALESCE(ag.checkins_30d, 0) AS checkins_30d,
      COALESCE(ag.workout_members_30d, 0) AS workout_members_30d,
      COALESCE(ag.checkin_members_30d, 0) AS checkin_members_30d,
      COALESCE(pl.plans_30d, 0) AS plans_30d, COALESCE(pl.planned_members, 0) AS planned_members,
      COALESCE(asm.assessments_30d, 0) AS assessments_30d,
      COALESCE(asm.assessed_members_90d, 0) AS assessed_members_90d,
      la.last_activity_at
    FROM g
      LEFT JOIN rc ON rc.gym_id = g.id
      LEFT JOIN ag ON ag.gym_id = g.id
      LEFT JOIN pl ON pl.gym_id = g.id
      LEFT JOIN asm ON asm.gym_id = g.id
      LEFT JOIN la ON la.gym_id = g.id
  ),
  calc AS (
    SELECT b.*,
      round(b.workout_members_30d::numeric / NULLIF(b.member_count, 0), 4) AS active_member_ratio,
      round(b.workouts_30d::numeric / NULLIF(b.workout_members_30d, 0), 2) AS wpam,
      round(b.checkin_members_30d::numeric / NULLIF(b.active_member_count, 0), 4) AS checkin_rate_30d,
      round(b.planned_members::numeric / NULLIF(b.member_count, 0), 4) AS plan_coverage,
      round(b.assessed_members_90d::numeric / NULLIF(b.member_count, 0), 4) AS assessed_90d_ratio,
      round(b.member_count::numeric / NULLIF(b.trainer_count, 0), 2) AS members_per_trainer
    FROM base b
  )
  SELECT c.id, c.name, c.slug, c.created_at, c.timezone, c.custom_domain, c.subscription_plan,
    c.is_enabled, c.disabled_at, c.payment_status, c.last_payment_at, c.next_due_at,
    c.monthly_amount, c.currency,
    c.member_count, c.active_member_count, c.trainer_count, c.admin_count,
    c.workouts_7d, c.workouts_30d, c.checkins_7d, c.checkins_30d,
    c.plans_30d, c.assessments_30d,
    c.active_member_ratio, c.wpam, c.checkin_rate_30d, c.plan_coverage, c.assessed_90d_ratio,
    c.members_per_trainer, c.last_activity_at,
    CASE WHEN c.last_activity_at IS NULL THEN NULL
         ELSE (c.today - (c.last_activity_at AT TIME ZONE c.timezone)::date)::int END,
    CASE WHEN c.member_count = 0 THEN 0::numeric ELSE round(
        40 * COALESCE(c.active_member_ratio, 0)
      + 30 * least(COALESCE(c.wpam, 0) / 8, 1)
      + 20 * COALESCE(c.checkin_rate_30d, 0)
      + 10 * COALESCE(c.plan_coverage, 0), 1) END
  FROM calc c
  ORDER BY c.name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_gyms() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_gyms() FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_gyms() TO authenticated;

-- ============ 1.5(c) platform_gym_detail ============
CREATE OR REPLACE FUNCTION public.platform_gym_detail(_gym_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(pg) INTO result FROM public.platform_gyms() pg WHERE pg.id = _gym_id;
  IF result IS NULL THEN RETURN NULL; END IF;

  result := result
    || (SELECT jsonb_build_object(
          'billing_email', g.billing_email,
          'support_email', g.support_email,
          'support_phone', g.support_phone,
          'internal_note', g.internal_note,
          'disabled_reason', g.disabled_reason)
        FROM public.gyms g WHERE g.id = _gym_id)
    || jsonb_build_object('staff', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'user_id', u.id, 'display_name', u.display_name, 'email', u.email,
                 'phone', u.phone, 'role', r.role, 'active', u.active,
                 'last_sign_in_at', u.last_sign_in_at)
               ORDER BY (r.role <> 'admin'), u.display_name)
        FROM public.users u JOIN public.user_roles r ON r.user_id = u.id
        WHERE r.gym_id = _gym_id AND r.role IN ('admin','trainer')), '[]'::jsonb));

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_gym_detail(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_gym_detail(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_gym_detail(uuid) TO authenticated;

-- ============ 1.5(d) platform_gym_admins ============
CREATE OR REPLACE FUNCTION public.platform_gym_admins()
RETURNS TABLE (gym_id uuid, gym_name text, gym_slug text, is_enabled boolean,
  user_id uuid, display_name text, email text, phone text, role public.app_role,
  active boolean, last_sign_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.slug, g.is_enabled, u.id, u.display_name, u.email, u.phone,
         r.role, u.active, u.last_sign_in_at
  FROM public.user_roles r
  JOIN public.gyms g ON g.id = r.gym_id
  JOIN public.users u ON u.id = r.user_id
  WHERE r.role IN ('admin','trainer')
  ORDER BY (r.role <> 'admin'), g.name, u.display_name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_gym_admins() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_gym_admins() FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_gym_admins() TO authenticated;

-- ============ 1.5(e) signup trend ============
CREATE OR REPLACE FUNCTION public.platform_signup_trend(_days int DEFAULT 90)
RETURNS TABLE (day date, gyms_created int, members_created int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day FROM generate_series(current_date - (_days - 1), current_date, interval '1 day') d
  ),
  gy AS (
    SELECT (g.created_at AT TIME ZONE g.timezone)::date AS day, count(*)::int n
    FROM public.gyms g GROUP BY 1
  ),
  mb AS (
    SELECT (u.created_at AT TIME ZONE COALESCE(g.timezone, 'UTC'))::date AS day, count(DISTINCT u.id)::int n
    FROM public.users u
    JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'member'
    LEFT JOIN public.gyms g ON g.id = u.gym_id
    GROUP BY 1
  )
  SELECT d.day, COALESCE(gy.n, 0), COALESCE(mb.n, 0)
  FROM days d LEFT JOIN gy ON gy.day = d.day LEFT JOIN mb ON mb.day = d.day
  ORDER BY d.day;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_signup_trend(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_signup_trend(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_signup_trend(int) TO authenticated;

-- ============ 1.5(f) activity trend ============
CREATE OR REPLACE FUNCTION public.platform_activity_trend(_days int DEFAULT 30)
RETURNS TABLE (day date, workouts int, checkins int, active_members int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day FROM generate_series(current_date - (_days - 1), current_date, interval '1 day') d
  ),
  a AS (
    SELECT pad.day, sum(pad.is_workout)::int w, sum(pad.is_checkin)::int c, count(DISTINCT pad.member_id)::int m
    FROM public.platform_activity_days pad
    WHERE pad.day >= current_date - (_days - 1) GROUP BY pad.day
  )
  SELECT d.day, COALESCE(a.w, 0), COALESCE(a.c, 0), COALESCE(a.m, 0)
  FROM days d LEFT JOIN a ON a.day = d.day ORDER BY d.day;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_activity_trend(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_activity_trend(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_activity_trend(int) TO authenticated;

-- ============ 1.5(g) per-gym activity trend ============
CREATE OR REPLACE FUNCTION public.platform_gym_activity_trend(_gym_id uuid, _days int DEFAULT 30)
RETURNS TABLE (day date, workouts int, checkins int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH tz AS (SELECT (now() AT TIME ZONE timezone)::date AS today FROM public.gyms WHERE id = _gym_id),
  days AS (
    SELECT d::date AS day FROM generate_series((SELECT today FROM tz) - (_days - 1), (SELECT today FROM tz), interval '1 day') d
  ),
  a AS (
    SELECT pad.day, sum(pad.is_workout)::int w, sum(pad.is_checkin)::int c
    FROM public.platform_activity_days pad WHERE pad.gym_id = _gym_id GROUP BY pad.day
  )
  SELECT d.day, COALESCE(a.w, 0), COALESCE(a.c, 0)
  FROM days d LEFT JOIN a ON a.day = d.day ORDER BY d.day;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_gym_activity_trend(uuid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_gym_activity_trend(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_gym_activity_trend(uuid, int) TO authenticated;

-- ============ 1.5(h) feature adoption ============
CREATE OR REPLACE FUNCTION public.platform_feature_adoption()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE total int; result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO total FROM public.gyms WHERE is_enabled;
  SELECT jsonb_build_object(
    'enabled_gyms', total,
    'plans', round(100.0 * (SELECT count(DISTINCT p.gym_id) FROM public.workout_plans p JOIN public.gyms g ON g.id = p.gym_id AND g.is_enabled) / NULLIF(total, 0), 1),
    'assessments', round(100.0 * (SELECT count(DISTINCT f.gym_id) FROM public.fitness_assessments f JOIN public.gyms g ON g.id = f.gym_id AND g.is_enabled) / NULLIF(total, 0), 1),
    'checkins', round(100.0 * (SELECT count(DISTINCT a.gym_id) FROM public.attendance_logs a JOIN public.gyms g ON g.id = a.gym_id AND g.is_enabled) / NULLIF(total, 0), 1),
    'qr_checkins', round(100.0 * (SELECT count(DISTINCT a.gym_id) FROM public.attendance_logs a JOIN public.gyms g ON g.id = a.gym_id AND g.is_enabled WHERE a.location_type = 'gym') / NULLIF(total, 0), 1),
    'messaging', round(100.0 * (SELECT count(DISTINCT m.gym_id) FROM public.messages m JOIN public.gyms g ON g.id = m.gym_id AND g.is_enabled) / NULLIF(total, 0), 1),
    'ai_overload', round(100.0 * (SELECT count(DISTINCT u.gym_id) FROM public.overload_suggestions o JOIN public.users u ON u.id = o.member_id JOIN public.gyms g ON g.id = u.gym_id AND g.is_enabled) / NULLIF(total, 0), 1),
    'progress_photos', round(100.0 * (SELECT count(DISTINCT p.gym_id) FROM public.progress_photos p JOIN public.gyms g ON g.id = p.gym_id AND g.is_enabled) / NULLIF(total, 0), 1)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_feature_adoption() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_feature_adoption() FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_feature_adoption() TO authenticated;

-- ============ 1.5(i) retention cohorts ============
CREATE OR REPLACE FUNCTION public.platform_retention_cohorts(_months int DEFAULT 6)
RETURNS TABLE (cohort_month date, cohort_size int, active_m1 int, active_m2 int, active_m3 int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH members AS (
    SELECT u.id, date_trunc('month', u.created_at)::date AS cohort
    FROM public.users u JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'member'
    WHERE u.created_at >= date_trunc('month', now()) - ((_months - 1) || ' months')::interval
  ),
  act AS (
    SELECT pad.member_id, date_trunc('month', pad.day)::date AS m
    FROM public.platform_activity_days pad GROUP BY 1, 2
  )
  SELECT m.cohort, count(DISTINCT m.id)::int,
    count(DISTINCT CASE WHEN a1.member_id IS NOT NULL THEN m.id END)::int,
    count(DISTINCT CASE WHEN a2.member_id IS NOT NULL THEN m.id END)::int,
    count(DISTINCT CASE WHEN a3.member_id IS NOT NULL THEN m.id END)::int
  FROM members m
    LEFT JOIN act a1 ON a1.member_id = m.id AND a1.m = (m.cohort + interval '1 month')::date
    LEFT JOIN act a2 ON a2.member_id = m.id AND a2.m = (m.cohort + interval '2 months')::date
    LEFT JOIN act a3 ON a3.member_id = m.id AND a3.m = (m.cohort + interval '3 months')::date
  GROUP BY m.cohort ORDER BY m.cohort;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_retention_cohorts(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_retention_cohorts(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_retention_cohorts(int) TO authenticated;

-- ============ 1.5(j) audit log read ============
CREATE OR REPLACE FUNCTION public.platform_audit_recent(_gym_id uuid DEFAULT NULL, _limit int DEFAULT 50)
RETURNS TABLE (id bigint, actor_id uuid, actor_email text, action text, gym_id uuid,
  gym_name text, detail jsonb, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT l.id, l.actor_id, u.email, l.action, l.gym_id, g.name, l.detail, l.created_at
  FROM public.platform_audit_log l
  LEFT JOIN public.users u ON u.id = l.actor_id
  LEFT JOIN public.gyms g ON g.id = l.gym_id
  WHERE _gym_id IS NULL OR l.gym_id = _gym_id
  ORDER BY l.created_at DESC
  LIMIT COALESCE(_limit, 50);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_audit_recent(uuid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_audit_recent(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_audit_recent(uuid, int) TO authenticated;

-- ============ 1.7 mutating RPCs ============
CREATE OR REPLACE FUNCTION public.platform_set_gym_enabled(_gym_id uuid, _enabled boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _before jsonb; _after jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT _enabled AND COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when disabling a gym';
  END IF;

  SELECT jsonb_build_object('is_enabled', is_enabled, 'disabled_at', disabled_at, 'disabled_reason', disabled_reason)
    INTO _before FROM public.gyms WHERE id = _gym_id;
  IF _before IS NULL THEN RAISE EXCEPTION 'Gym not found'; END IF;

  UPDATE public.gyms SET
    is_enabled = _enabled,
    disabled_at = CASE WHEN _enabled THEN NULL ELSE now() END,
    disabled_reason = CASE WHEN _enabled THEN NULL ELSE btrim(_reason) END
  WHERE id = _gym_id;

  SELECT jsonb_build_object('is_enabled', is_enabled, 'disabled_at', disabled_at, 'disabled_reason', disabled_reason)
    INTO _after FROM public.gyms WHERE id = _gym_id;

  INSERT INTO public.platform_audit_log (actor_id, action, gym_id, detail)
  VALUES (auth.uid(), CASE WHEN _enabled THEN 'enable_gym' ELSE 'disable_gym' END, _gym_id,
          jsonb_build_object('before', _before, 'after', _after, 'reason', _reason));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_set_gym_enabled(uuid, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_set_gym_enabled(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_set_gym_enabled(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_set_payment_status(
  _gym_id uuid, _status public.gym_payment_status, _last_payment_at date DEFAULT NULL,
  _next_due_at date DEFAULT NULL, _monthly_amount numeric DEFAULT NULL,
  _currency text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _before jsonb; _after jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object('payment_status', payment_status, 'last_payment_at', last_payment_at,
      'next_due_at', next_due_at, 'monthly_amount', monthly_amount, 'currency', currency,
      'internal_note', internal_note)
    INTO _before FROM public.gyms WHERE id = _gym_id;
  IF _before IS NULL THEN RAISE EXCEPTION 'Gym not found'; END IF;

  UPDATE public.gyms SET
    payment_status = _status,
    last_payment_at = _last_payment_at,
    next_due_at = _next_due_at,
    monthly_amount = _monthly_amount,
    currency = COALESCE(NULLIF(btrim(_currency), ''), currency),
    internal_note = COALESCE(_note, internal_note)
  WHERE id = _gym_id;

  SELECT jsonb_build_object('payment_status', payment_status, 'last_payment_at', last_payment_at,
      'next_due_at', next_due_at, 'monthly_amount', monthly_amount, 'currency', currency,
      'internal_note', internal_note)
    INTO _after FROM public.gyms WHERE id = _gym_id;

  INSERT INTO public.platform_audit_log (actor_id, action, gym_id, detail)
  VALUES (auth.uid(), 'set_payment_status', _gym_id,
          jsonb_build_object('before', _before, 'after', _after, 'reason', _note));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_set_payment_status(uuid, public.gym_payment_status, date, date, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_set_payment_status(uuid, public.gym_payment_status, date, date, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_set_payment_status(uuid, public.gym_payment_status, date, date, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_set_gym_plan(_gym_id uuid, _plan public.subscription_plan)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _before jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object('subscription_plan', subscription_plan) INTO _before
    FROM public.gyms WHERE id = _gym_id;
  IF _before IS NULL THEN RAISE EXCEPTION 'Gym not found'; END IF;

  UPDATE public.gyms SET subscription_plan = _plan WHERE id = _gym_id;

  INSERT INTO public.platform_audit_log (actor_id, action, gym_id, detail)
  VALUES (auth.uid(), 'set_plan', _gym_id,
          jsonb_build_object('before', _before, 'after', jsonb_build_object('subscription_plan', _plan)));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_set_gym_plan(uuid, public.subscription_plan) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_set_gym_plan(uuid, public.subscription_plan) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_set_gym_plan(uuid, public.subscription_plan) TO authenticated;