-- 1. Restore staff-only WITH CHECK on plan tables (USING clauses unchanged)
DROP POLICY IF EXISTS "Workout plan access" ON public.workout_plans;
CREATE POLICY "Workout plan access" ON public.workout_plans
FOR ALL
USING (
  gym_id = public.current_gym_id()
  AND (member_id = auth.uid() OR member_id IS NULL OR public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(member_id))
)
WITH CHECK (
  gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
);

DROP POLICY IF EXISTS "Workout day access" ON public.workout_days;
CREATE POLICY "Workout day access" ON public.workout_days
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workout_plans p
    WHERE p.id = workout_days.plan_id
      AND p.gym_id = public.current_gym_id()
      AND (p.member_id = auth.uid() OR p.member_id IS NULL OR public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(p.member_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workout_plans p
    WHERE p.id = workout_days.plan_id
      AND p.gym_id = public.current_gym_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
  )
);

DROP POLICY IF EXISTS "Workout exercise access" ON public.workout_exercises;
CREATE POLICY "Workout exercise access" ON public.workout_exercises
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workout_days d
    JOIN public.workout_plans p ON p.id = d.plan_id
    WHERE d.id = workout_exercises.day_id
      AND p.gym_id = public.current_gym_id()
      AND (p.member_id = auth.uid() OR p.member_id IS NULL OR public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(p.member_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workout_days d
    JOIN public.workout_plans p ON p.id = d.plan_id
    WHERE d.id = workout_exercises.day_id
      AND p.gym_id = public.current_gym_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
  )
);

-- 2. Codify attendance_buckets in migration history (was live-only schema drift)
CREATE OR REPLACE FUNCTION public.attendance_buckets(_gym_id uuid, _start date, _end date)
RETURNS TABLE(day date, hour integer, member_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ((a.check_in_at AT TIME ZONE g.timezone))::date AS day,
    EXTRACT(hour FROM (a.check_in_at AT TIME ZONE g.timezone))::int AS hour,
    a.member_id,
    count(*) AS cnt
  FROM public.attendance_logs a
  JOIN public.gyms g ON g.id = a.gym_id
  WHERE a.gym_id = _gym_id
    AND ((a.check_in_at AT TIME ZONE g.timezone))::date BETWEEN _start AND _end
  GROUP BY 1, 2, 3
$$;

REVOKE ALL ON FUNCTION public.attendance_buckets(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attendance_buckets(uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.attendance_buckets(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_buckets(uuid, date, date) TO service_role;