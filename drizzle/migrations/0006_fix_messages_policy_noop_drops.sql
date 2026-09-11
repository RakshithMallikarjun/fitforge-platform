-- The 20260723115950 migration intended to tighten public.messages RLS, but its
-- DROP POLICY IF EXISTS statements named policies that never existed, so the
-- original permissive policies survived. Because permissive policies OR together,
-- "send own messages" (no recipient-gym check) still allowed cross-gym inserts.
-- Drop the stale originals and re-assert the intended set idempotently.

DROP POLICY IF EXISTS "send own messages" ON public.messages;
DROP POLICY IF EXISTS "read own conversations" ON public.messages;
DROP POLICY IF EXISTS "mark received as read" ON public.messages;

DROP POLICY IF EXISTS "Message read" ON public.messages;
CREATE POLICY "Message read"
  ON public.messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "Message send" ON public.messages;
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

DROP POLICY IF EXISTS "Message update read_at" ON public.messages;
CREATE POLICY "Message update read_at"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Admin-read decision: KEEP, as an explicit named policy rather than a leftover.
-- Reason: the admin engagement report (getEngagementReport in
-- src/lib/admin-stats.functions.ts) reads gym-wide message metadata through the
-- caller's own RLS context to compute member/trainer communication activity.
-- Without a gym-admin SELECT policy that report silently returns nothing.
-- Scope is deliberately narrow: gym admins only, and only rows in their own gym.
DROP POLICY IF EXISTS "Message read (gym admin)" ON public.messages;
CREATE POLICY "Message read (gym admin)"
  ON public.messages FOR SELECT
  TO authenticated
  USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'));
