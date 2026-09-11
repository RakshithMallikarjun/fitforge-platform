-- Align "active members" across consoles.
-- Active account      = users.active = true
-- Active membership   = active account AND (member_profiles.membership_expires_at IS NULL
--                       OR membership_expires_at >= today in the gym's timezone)
-- platform_gyms.active_member_count now means active MEMBERSHIPS, matching getAdminStats.
CREATE OR REPLACE FUNCTION public.platform_gyms()
 RETURNS TABLE(id uuid, name text, slug text, created_at timestamp with time zone, timezone text, custom_domain text, subscription_plan subscription_plan, is_enabled boolean, disabled_at timestamp with time zone, payment_status gym_payment_status, last_payment_at date, next_due_at date, monthly_amount numeric, currency text, member_count integer, active_member_count integer, trainer_count integer, admin_count integer, workouts_7d integer, workouts_30d integer, checkins_7d integer, checkins_30d integer, plans_30d integer, assessments_30d integer, active_member_ratio numeric, workouts_per_active_member_30d numeric, checkin_rate_30d numeric, plan_coverage numeric, assessed_90d_ratio numeric, members_per_trainer numeric, last_activity_at timestamp with time zone, days_since_activity integer, health_score numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH g AS (SELECT gy.*, (now() AT TIME ZONE gy.timezone)::date AS today FROM public.gyms gy),
  rc AS (
    SELECT r.gym_id,
      count(DISTINCT CASE WHEN r.role = 'member' THEN r.user_id END)::int AS member_count,
      count(DISTINCT CASE WHEN r.role = 'member' AND u.active THEN r.user_id END)::int AS active_account_count,
      count(DISTINCT CASE WHEN r.role = 'member' AND u.active
                           AND (mp.membership_expires_at IS NULL OR mp.membership_expires_at >= gg.today)
                          THEN r.user_id END)::int AS active_member_count,
      count(DISTINCT CASE WHEN r.role = 'trainer' THEN r.user_id END)::int AS trainer_count,
      count(DISTINCT CASE WHEN r.role = 'admin' THEN r.user_id END)::int AS admin_count
    FROM public.user_roles r
      LEFT JOIN public.users u ON u.id = r.user_id
      LEFT JOIN public.member_profiles mp ON mp.user_id = r.user_id
      LEFT JOIN g gg ON gg.id = r.gym_id
    GROUP BY r.gym_id
  ),
  a AS (SELECT d.*, gg.today FROM public.platform_activity_days d JOIN g gg ON gg.id = d.gym_id),
  ag AS (
    SELECT a.gym_id,
      sum(CASE WHEN a.is_workout = 1 AND a.day > a.today - 7 THEN 1 ELSE 0 END)::int AS workouts_7d,
      sum(CASE WHEN a.is_workout = 1 AND a.day > a.today - 30 THEN 1 ELSE 0 END)::int AS workouts_30d,
      sum(CASE WHEN a.is_checkin = 1 AND a.day > a.today - 7 THEN 1 ELSE 0 END)::int AS checkins_7d,
      sum(CASE WHEN a.is_checkin = 1 AND a.day > a.today - 30 THEN 1 ELSE 0 END)::int AS checkins_30d,
      count(DISTINCT CASE WHEN a.is_workout = 1 AND a.day > a.today - 30 THEN a.member_id END)::int AS workout_members_30d,
      count(DISTINCT CASE WHEN a.is_checkin = 1 AND a.day > a.today - 30 THEN a.member_id END)::int AS checkin_members_30d
    FROM a GROUP BY a.gym_id
  ),
  la AS (
    SELECT s.gym_id, max(s.ts) AS last_activity_at FROM (
      SELECT wl.gym_id, COALESCE(wl.completed_at, wl.created_at) AS ts FROM public.workout_logs wl
      UNION ALL SELECT al.gym_id, al.check_in_at FROM public.attendance_logs al
    ) s GROUP BY s.gym_id
  ),
  pl AS (
    SELECT wp.gym_id,
      count(*) FILTER (WHERE wp.created_at >= now() - interval '30 days')::int AS plans_30d,
      count(DISTINCT CASE WHEN wp.status <> 'archived' THEN wp.member_id END)::int AS planned_members
    FROM public.workout_plans wp GROUP BY wp.gym_id
  ),
  asm AS (
    SELECT fa.gym_id,
      count(*) FILTER (WHERE fa.created_at >= now() - interval '30 days')::int AS assessments_30d,
      count(DISTINCT CASE WHEN fa.date >= (current_date - 90) THEN fa.member_id END)::int AS assessed_members_90d
    FROM public.fitness_assessments fa GROUP BY fa.gym_id
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
$function$;

REVOKE ALL ON FUNCTION public.platform_gyms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_gyms() TO authenticated;

-- platform_overview.active_members follows the same membership definition.
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
    'active_members', (
      SELECT count(DISTINCT r.user_id)
      FROM public.user_roles r
        JOIN public.users u ON u.id = r.user_id
        LEFT JOIN public.member_profiles mp ON mp.user_id = r.user_id
        LEFT JOIN gtoday t ON t.gym_id = r.gym_id
      WHERE r.role = 'member' AND u.active
        AND (mp.membership_expires_at IS NULL OR mp.membership_expires_at >= COALESCE(t.today, current_date))
    ),
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
