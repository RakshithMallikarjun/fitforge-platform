CREATE TABLE public.overload_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion JSONB NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overload_suggestions TO authenticated;
GRANT ALL ON public.overload_suggestions TO service_role;

ALTER TABLE public.overload_suggestions ENABLE ROW LEVEL SECURITY;

-- Members can read their own approved suggestions
CREATE POLICY "Members read own approved suggestions"
ON public.overload_suggestions FOR SELECT TO authenticated
USING (member_id = auth.uid() AND approved_at IS NOT NULL);

-- Trainers/admins in the same gym can read + write all
CREATE POLICY "Staff manage suggestions in gym"
ON public.overload_suggestions FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = overload_suggestions.member_id
      AND u.gym_id = public.current_gym_id()
  )
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = overload_suggestions.member_id
      AND u.gym_id = public.current_gym_id()
  )
);

CREATE INDEX idx_overload_suggestions_plan ON public.overload_suggestions(plan_id);
CREATE INDEX idx_overload_suggestions_member ON public.overload_suggestions(member_id);

CREATE TRIGGER set_overload_suggestions_updated_at
BEFORE UPDATE ON public.overload_suggestions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();