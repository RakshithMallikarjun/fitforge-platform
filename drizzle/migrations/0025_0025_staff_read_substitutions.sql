GRANT SELECT ON public.workout_exercise_substitutions TO authenticated;
DROP POLICY IF EXISTS "staff read member substitutions" ON public.workout_exercise_substitutions;
CREATE POLICY "staff read member substitutions"
  ON public.workout_exercise_substitutions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = workout_exercise_substitutions.member_id
        AND u.gym_id = public.current_gym_id()
    )
    AND (public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(member_id))
  );