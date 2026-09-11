-- 1) users: members may no longer read every other member's row (email/phone/photo).
CREATE OR REPLACE FUNCTION public.is_gym_staff_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.users u ON u.id = r.user_id
    WHERE r.user_id = _user_id
      AND r.role IN ('admin', 'trainer')
      AND r.gym_id = public.current_gym_id()
      AND u.gym_id = public.current_gym_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_gym_staff_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gym_staff_user(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users read same gym" ON public.users;

CREATE POLICY "Users read own row"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Staff read gym users"
ON public.users FOR SELECT TO authenticated
USING (
  gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
);

-- Members still need to see the staff they talk to (trainers/admins of their gym).
CREATE POLICY "Members read gym staff"
ON public.users FOR SELECT TO authenticated
USING (gym_id = public.current_gym_id() AND public.is_gym_staff_user(id));

-- 2) gyms: billing/internal columns must not be readable through the Data API.
REVOKE SELECT ON public.gyms FROM authenticated;
REVOKE SELECT ON public.gyms FROM anon;

GRANT SELECT (
  id, name, slug, logo_url, primary_color, secondary_color, font_family,
  custom_domain, timezone, support_email, support_phone, is_enabled
) ON public.gyms TO authenticated;

GRANT SELECT (id, name, slug, logo_url, primary_color, secondary_color, font_family)
ON public.gyms TO anon;

-- 3) SECURITY DEFINER hardening.
-- attendance_buckets bypasses RLS and took an arbitrary gym id: authorize the caller.
CREATE OR REPLACE FUNCTION public.attendance_buckets(_gym_id uuid, _start date, _end date)
RETURNS TABLE(day date, hour integer, member_id uuid, cnt bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    (_gym_id = public.current_gym_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer')))
    OR public.is_platform_admin()
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ((a.check_in_at AT TIME ZONE g.timezone))::date AS day,
    EXTRACT(hour FROM (a.check_in_at AT TIME ZONE g.timezone))::int AS hour,
    a.member_id,
    count(*) AS cnt
  FROM public.attendance_logs a
  JOIN public.gyms g ON g.id = a.gym_id
  WHERE a.gym_id = _gym_id
    AND ((a.check_in_at AT TIME ZONE g.timezone))::date BETWEEN _start AND _end
  GROUP BY 1, 2, 3;
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_buckets(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_buckets(uuid, date, date) TO authenticated, service_role;

-- verify_join_code was an anonymous oracle over gym join codes; server-side only now.
REVOKE ALL ON FUNCTION public.verify_join_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_join_code(text, text) TO service_role;

-- Internal policy helpers must never be callable anonymously.
REVOKE ALL ON FUNCTION public.current_gym_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_gym_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_trainer_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_trainer_of(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_gym_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_gym_enabled() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.touch_last_sign_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_sign_in() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_gym_staff_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gym_staff_user(uuid) TO authenticated, service_role;