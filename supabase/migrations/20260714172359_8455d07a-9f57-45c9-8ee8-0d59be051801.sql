
-- Allow any admin/trainer in the same gym to read plans (and their days/exercises).
-- Writes remain restricted to the assigned member, the member's trainer, or an admin.

-- workout_plans
ALTER POLICY "Workout plan access" ON public.workout_plans
  USING (
    gym_id = current_gym_id()
    AND (member_id = auth.uid() OR is_trainer_of(member_id) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Workout plan read (gym staff)" ON public.workout_plans;
CREATE POLICY "Workout plan read (gym staff)" ON public.workout_plans
  FOR SELECT
  USING (
    gym_id = current_gym_id()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trainer'::app_role))
  );

-- workout_days
DROP POLICY IF EXISTS "Workout day read (gym staff)" ON public.workout_days;
CREATE POLICY "Workout day read (gym staff)" ON public.workout_days
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_plans wp
      WHERE wp.id = workout_days.plan_id
        AND wp.gym_id = current_gym_id()
        AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trainer'::app_role))
    )
  );

-- workout_exercises
DROP POLICY IF EXISTS "Workout exercise read (gym staff)" ON public.workout_exercises;
CREATE POLICY "Workout exercise read (gym staff)" ON public.workout_exercises
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workout_days wd
      JOIN public.workout_plans wp ON wp.id = wd.plan_id
      WHERE wd.id = workout_exercises.day_id
        AND wp.gym_id = current_gym_id()
        AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trainer'::app_role))
    )
  );
