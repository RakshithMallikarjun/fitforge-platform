
DROP POLICY IF EXISTS "Exercise log access" ON public.exercise_logs;
CREATE POLICY "Exercise log access"
  ON public.exercise_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_logs wl
      WHERE wl.id = exercise_logs.log_id
        AND (
          wl.member_id = auth.uid()
          OR public.has_role(auth.uid(),'admin')
          OR public.is_trainer_of(wl.member_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_logs wl
      WHERE wl.id = exercise_logs.log_id
        AND (
          wl.member_id = auth.uid()
          OR public.has_role(auth.uid(),'admin')
          OR public.is_trainer_of(wl.member_id)
        )
    )
  );

DROP POLICY IF EXISTS "Workout log access" ON public.workout_logs;
CREATE POLICY "Workout log access"
  ON public.workout_logs FOR ALL
  TO authenticated
  USING (
    member_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.is_trainer_of(member_id)
  )
  WITH CHECK (
    member_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.is_trainer_of(member_id)
  );

DROP POLICY IF EXISTS "Workout plan access" ON public.workout_plans;
CREATE POLICY "Workout plan access"
  ON public.workout_plans FOR ALL
  TO authenticated
  USING (
    gym_id = public.current_gym_id()
    AND (
      member_id = auth.uid()
      OR member_id IS NULL
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'trainer')
    )
  )
  WITH CHECK (
    gym_id = public.current_gym_id()
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'trainer')
    )
  );

DROP POLICY IF EXISTS "Workout day access" ON public.workout_days;
CREATE POLICY "Workout day access"
  ON public.workout_days FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_plans p
      WHERE p.id = workout_days.plan_id
        AND p.gym_id = public.current_gym_id()
        AND (
          p.member_id = auth.uid()
          OR p.member_id IS NULL
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'trainer')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_plans p
      WHERE p.id = workout_days.plan_id
        AND p.gym_id = public.current_gym_id()
        AND (
          public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'trainer')
        )
    )
  );

DROP POLICY IF EXISTS "Workout exercise access" ON public.workout_exercises;
CREATE POLICY "Workout exercise access"
  ON public.workout_exercises FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_days d
      JOIN public.workout_plans p ON p.id = d.plan_id
      WHERE d.id = workout_exercises.day_id
        AND p.gym_id = public.current_gym_id()
        AND (
          p.member_id = auth.uid()
          OR p.member_id IS NULL
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'trainer')
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
          public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'trainer')
        )
    )
  );

-- Same-gym enforcement for direct messages
DROP POLICY IF EXISTS "Messages access" ON public.messages;
DROP POLICY IF EXISTS "Message send" ON public.messages;
DROP POLICY IF EXISTS "Message read" ON public.messages;
DROP POLICY IF EXISTS "Message update read_at" ON public.messages;

CREATE POLICY "Message read"
  ON public.messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Message send"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND gym_id = public.current_gym_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = messages.recipient_id
        AND u.gym_id = public.current_gym_id()
    )
  );

CREATE POLICY "Message update read_at"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
