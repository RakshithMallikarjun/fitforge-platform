CREATE TABLE IF NOT EXISTS public.workout_exercise_substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_workout_exercise_id uuid NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  substitute_exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(original_workout_exercise_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercise_substitutions TO authenticated;
GRANT ALL ON public.workout_exercise_substitutions TO service_role;

ALTER TABLE public.workout_exercise_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member manages own substitutions" ON public.workout_exercise_substitutions
  FOR ALL TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());