
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS experience_level text CHECK (experience_level IN ('beginner','intermediate','advanced')),
  ADD COLUMN IF NOT EXISTS membership_type text,
  ADD COLUMN IF NOT EXISTS membership_expires_at date;

CREATE TABLE IF NOT EXISTS public.member_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_notes_member_idx ON public.member_notes(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS member_notes_gym_idx ON public.member_notes(gym_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_notes TO authenticated;
GRANT ALL ON public.member_notes TO service_role;

ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read gym notes" ON public.member_notes
  FOR SELECT TO authenticated
  USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins write gym notes" ON public.member_notes
  FOR ALL TO authenticated
  USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "trainers read own notes for assigned" ON public.member_notes
  FOR SELECT TO authenticated
  USING (
    gym_id = public.current_gym_id()
    AND public.has_role(auth.uid(), 'trainer')
    AND public.is_trainer_of(member_id)
  );

CREATE POLICY "trainers insert notes for assigned" ON public.member_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    gym_id = public.current_gym_id()
    AND public.has_role(auth.uid(), 'trainer')
    AND public.is_trainer_of(member_id)
    AND author_id = auth.uid()
  );

CREATE POLICY "trainers update own notes" ON public.member_notes
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'))
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "trainers delete own notes" ON public.member_notes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_notes_set_updated_at ON public.member_notes;
CREATE TRIGGER member_notes_set_updated_at
BEFORE UPDATE ON public.member_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
