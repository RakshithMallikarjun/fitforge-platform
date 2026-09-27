ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

DROP POLICY IF EXISTS "Staff record check-in" ON public.attendance_logs;
CREATE POLICY "Staff record check-in" ON public.attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    gym_id = public.current_gym_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = member_id AND u.gym_id = public.current_gym_id())
  );

DROP POLICY IF EXISTS "Staff update check-in" ON public.attendance_logs;
CREATE POLICY "Staff update check-in" ON public.attendance_logs
  FOR UPDATE TO authenticated
  USING (
    gym_id = public.current_gym_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
  )
  WITH CHECK (
    gym_id = public.current_gym_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = member_id AND u.gym_id = public.current_gym_id())
  );

GRANT SELECT, INSERT, UPDATE ON public.attendance_logs TO authenticated;