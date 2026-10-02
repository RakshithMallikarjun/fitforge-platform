CREATE OR REPLACE FUNCTION public.platform_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'new_gyms_14d', (SELECT count(*) FROM public.gyms WHERE is_enabled AND created_at > now() - interval '14 days'),
    'at_risk_gyms', (SELECT count(*) FROM public.gyms g WHERE g.is_enabled
        AND g.created_at <= now() - interval '14 days'
        AND NOT EXISTS (SELECT 1 FROM act a WHERE a.gym_id = g.id AND a.day > a.today - 14)),
    'overdue_gyms', (SELECT count(*) FROM public.gyms WHERE payment_status IN ('overdue','failed'))
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.platform_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_overview() TO authenticated;