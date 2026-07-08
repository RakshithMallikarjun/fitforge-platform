CREATE TABLE IF NOT EXISTS public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  weight numeric NOT NULL,
  reps integer,
  achieved_at date NOT NULL DEFAULT CURRENT_DATE,
  log_id uuid REFERENCES public.workout_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, exercise_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_records TO authenticated;
GRANT ALL ON public.personal_records TO service_role;

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member/trainer/admin access" ON public.personal_records
  FOR ALL TO authenticated
  USING (member_id = auth.uid() OR public.is_trainer_of(member_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (member_id = auth.uid() OR public.is_trainer_of(member_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS personal_records_member_achieved_idx ON public.personal_records(member_id, achieved_at DESC);