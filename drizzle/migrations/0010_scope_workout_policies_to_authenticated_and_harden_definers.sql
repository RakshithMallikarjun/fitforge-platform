-- 1. Scope the three workout policies explicitly to the authenticated role, so
--    anonymous requests are rejected by role rather than incidentally by
--    current_gym_id() resolving to NULL. USING/WITH CHECK logic is unchanged.

DROP POLICY IF EXISTS "Workout plan access" ON public.workout_plans;
CREATE POLICY "Workout plan access" ON public.workout_plans
  FOR ALL TO authenticated
  USING (
    gym_id = public.current_gym_id()
    AND (
      member_id = auth.uid()
      OR member_id IS NULL
      OR public.has_role(auth.uid(), 'admin')
      OR public.is_trainer_of(member_id)
    )
  )
  WITH CHECK (
    gym_id = public.current_gym_id()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'trainer')
    )
  );

DROP POLICY IF EXISTS "Workout day access" ON public.workout_days;
CREATE POLICY "Workout day access" ON public.workout_days
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_plans p
      WHERE p.id = workout_days.plan_id
        AND p.gym_id = public.current_gym_id()
        AND (
          p.member_id = auth.uid()
          OR p.member_id IS NULL
          OR public.has_role(auth.uid(), 'admin')
          OR public.is_trainer_of(p.member_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_plans p
      WHERE p.id = workout_days.plan_id
        AND p.gym_id = public.current_gym_id()
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'trainer')
        )
    )
  );

DROP POLICY IF EXISTS "Workout exercise access" ON public.workout_exercises;
CREATE POLICY "Workout exercise access" ON public.workout_exercises
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_days d
      JOIN public.workout_plans p ON p.id = d.plan_id
      WHERE d.id = workout_exercises.day_id
        AND p.gym_id = public.current_gym_id()
        AND (
          p.member_id = auth.uid()
          OR p.member_id IS NULL
          OR public.has_role(auth.uid(), 'admin')
          OR public.is_trainer_of(p.member_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_days d
      JOIN public.workout_plans p ON p.id = d.plan_id
      WHERE d.id = workout_exercises.day_id
        AND p.gym_id = public.current_gym_id()
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'trainer')
        )
    )
  );

-- 2. SECURITY DEFINER hardening: has_role() and is_gym_staff_user() accept an
--    arbitrary user id and bypass RLS on user_roles, so any signed-in user could
--    probe another member's roles. Restrict answers to the caller's own row
--    unless the caller is staff of the same gym. All RLS policies call these with
--    auth.uid(), so the self case keeps them working unchanged.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _user_id <> auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.user_roles cr
      WHERE cr.user_id = auth.uid()
        AND cr.role IN ('admin', 'trainer')
        AND cr.gym_id = public.current_gym_id()
    ) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
        AND gym_id = public.current_gym_id()
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_gym_staff_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _user_id <> auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.user_roles cr
      WHERE cr.user_id = auth.uid()
        AND cr.role IN ('admin', 'trainer')
        AND cr.gym_id = public.current_gym_id()
    ) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles r
      JOIN public.users u ON u.id = r.user_id
      WHERE r.user_id = _user_id
        AND r.role IN ('admin', 'trainer')
        AND r.gym_id = public.current_gym_id()
        AND u.gym_id = public.current_gym_id()
    )
  END;
$$;

-- Keep execution off anonymous/public for every SECURITY DEFINER helper. The
-- functions that remain executable by authenticated are either required by RLS
-- policy expressions or enforce their own in-function authorization.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_gym_staff_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_gym_staff_user(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_gym_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_trainer_of(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_gym_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_last_sign_in() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attendance_buckets(uuid, date, date) FROM PUBLIC, anon;
