CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_recipient_created_idx ON public.messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_gym_pair_idx ON public.messages(gym_id, sender_id, recipient_id);

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "send own messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND gym_id = public.current_gym_id());

CREATE POLICY "read own conversations" ON public.messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "mark received as read" ON public.messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;