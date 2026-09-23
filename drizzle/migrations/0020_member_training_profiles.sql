-- ============ member training profiles (AI plan inputs) ============
CREATE TABLE IF NOT EXISTS public.member_training_profiles (
  member_id       uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  gym_id          uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  goals           text NOT NULL DEFAULT '' CHECK (char_length(goals) <= 1000),
  limitations     text NOT NULL DEFAULT '' CHECK (char_length(limitations) <= 1000),
  equipment       text[] NOT NULL DEFAULT '{}',
  days_per_week   int NOT NULL DEFAULT 3 CHECK (days_per_week BETWEEN 1 AND 7),
  session_minutes int NOT NULL DEFAULT 60 CHECK (session_minutes BETWEEN 15 AND 180),
  experience      text NOT NULL DEFAULT 'beginner'
                    CHECK (experience IN ('beginner','intermediate','advanced')),
  updated_by      uuid REFERENCES auth.users(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_training_profiles_gym_idx
  ON public.member_training_profiles (gym_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_training_profiles TO authenticated;
GRANT ALL ON public.member_training_profiles TO service_role;
ALTER TABLE public.member_training_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_training_profiles_read ON public.member_training_profiles;
CREATE POLICY member_training_profiles_read ON public.member_training_profiles
FOR SELECT TO authenticated
USING (
  gym_id = public.current_gym_id()
  AND (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'trainer')
    OR member_id = auth.uid()
  )
);

DROP POLICY IF EXISTS member_training_profiles_staff_insert ON public.member_training_profiles;
CREATE POLICY member_training_profiles_staff_insert ON public.member_training_profiles
FOR INSERT TO authenticated
WITH CHECK (
  gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
);

DROP POLICY IF EXISTS member_training_profiles_staff_update ON public.member_training_profiles;
CREATE POLICY member_training_profiles_staff_update ON public.member_training_profiles
FOR UPDATE TO authenticated
USING (
  gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
)
WITH CHECK (
  gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
);

DROP POLICY IF EXISTS member_training_profiles_staff_delete ON public.member_training_profiles;
CREATE POLICY member_training_profiles_staff_delete ON public.member_training_profiles
FOR DELETE TO authenticated
USING (
  gym_id = public.current_gym_id()
  AND public.has_role(auth.uid(),'admin')
);

-- ---------- AI plan generation audit / daily cap ----------
CREATE TABLE IF NOT EXISTS public.ai_plan_generations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by  uuid REFERENCES auth.users(id),
  gym_day     date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_plan_generations_cap_idx
  ON public.ai_plan_generations (gym_id, gym_day);

GRANT SELECT, INSERT ON public.ai_plan_generations TO authenticated;
GRANT ALL ON public.ai_plan_generations TO service_role;
ALTER TABLE public.ai_plan_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_plan_generations_staff_read ON public.ai_plan_generations;
CREATE POLICY ai_plan_generations_staff_read ON public.ai_plan_generations
FOR SELECT TO authenticated
USING (
  gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
);

DROP POLICY IF EXISTS ai_plan_generations_staff_insert ON public.ai_plan_generations;
CREATE POLICY ai_plan_generations_staff_insert ON public.ai_plan_generations
FOR INSERT TO authenticated
WITH CHECK (
  gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
);
