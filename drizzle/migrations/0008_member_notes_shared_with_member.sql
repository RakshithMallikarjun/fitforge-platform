-- Trainer notes stay internal by default. A trainer/admin can opt a single note
-- into being visible to the member, which powers the "From your trainer" card.
ALTER TABLE public.member_notes
  ADD COLUMN IF NOT EXISTS shared_with_member boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "members read shared notes" ON public.member_notes;
CREATE POLICY "members read shared notes"
  ON public.member_notes
  FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid()
    AND shared_with_member = true
    AND gym_id = public.current_gym_id()
  );