
-- Allow any trainer/admin in the gym to create plans (including templates where member_id = self).
DROP POLICY IF EXISTS "Workout plan access" ON public.workout_plans;
CREATE POLICY "Workout plan access" ON public.workout_plans
FOR ALL
USING (
  gym_id = current_gym_id()
  AND (
    member_id = auth.uid()
    OR is_trainer_of(member_id)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  )
)
WITH CHECK (
  gym_id = current_gym_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  )
);

DROP POLICY IF EXISTS "Workout day access" ON public.workout_days;
CREATE POLICY "Workout day access" ON public.workout_days
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workout_plans wp
    WHERE wp.id = workout_days.plan_id
      AND wp.gym_id = current_gym_id()
      AND (
        wp.member_id = auth.uid()
        OR is_trainer_of(wp.member_id)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'trainer'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workout_plans wp
    WHERE wp.id = workout_days.plan_id
      AND wp.gym_id = current_gym_id()
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'trainer'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Workout exercise access" ON public.workout_exercises;
CREATE POLICY "Workout exercise access" ON public.workout_exercises
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workout_days wd JOIN workout_plans wp ON wp.id = wd.plan_id
    WHERE wd.id = workout_exercises.day_id
      AND wp.gym_id = current_gym_id()
      AND (
        wp.member_id = auth.uid()
        OR is_trainer_of(wp.member_id)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'trainer'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workout_days wd JOIN workout_plans wp ON wp.id = wd.plan_id
    WHERE wd.id = workout_exercises.day_id
      AND wp.gym_id = current_gym_id()
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'trainer'::app_role)
      )
  )
);
