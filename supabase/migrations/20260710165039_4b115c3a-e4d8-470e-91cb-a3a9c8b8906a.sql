CREATE TABLE IF NOT EXISTS public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.fitness_assessments(id) ON DELETE SET NULL,
  photo_url text NOT NULL,
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_photos TO authenticated;
GRANT ALL ON public.progress_photos TO service_role;

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member/trainer/admin access" ON public.progress_photos
  FOR ALL TO authenticated
  USING (member_id = auth.uid() OR public.is_trainer_of(member_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (member_id = auth.uid() OR public.is_trainer_of(member_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS progress_photos_member_taken_idx ON public.progress_photos (member_id, taken_at);