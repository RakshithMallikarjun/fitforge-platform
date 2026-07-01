CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_value numeric,
  current_value numeric,
  unit text,
  target_date date,
  achieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_member_idx ON public.goals(member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member manages own goals" ON public.goals FOR ALL TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid() AND gym_id = public.current_gym_id());
CREATE POLICY "trainer/admin view goals" ON public.goals FOR SELECT TO authenticated
  USING (gym_id = public.current_gym_id() AND
    (public.is_trainer_of(member_id) OR public.has_role(auth.uid(), 'admin')));