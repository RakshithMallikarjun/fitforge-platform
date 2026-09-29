-- 1. One active plan per member: archive all but the newest, then enforce.
UPDATE public.workout_plans wp SET status = 'archived'
WHERE wp.status = 'active' AND NOT wp.is_template AND wp.member_id IS NOT NULL
  AND wp.id <> (
    SELECT id FROM public.workout_plans x
    WHERE x.member_id = wp.member_id AND x.status = 'active' AND NOT x.is_template
    ORDER BY x.created_at DESC, x.id DESC LIMIT 1);

CREATE UNIQUE INDEX IF NOT EXISTS workout_plans_one_active_per_member
  ON public.workout_plans (member_id)
  WHERE status = 'active' AND NOT is_template AND member_id IS NOT NULL;

-- 2. Plan edits keep logged content: removed days/exercises with history are hidden, not deleted.
ALTER TABLE public.workout_days ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE public.workout_exercises ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

-- 3. Assessment edit tracking.
ALTER TABLE public.fitness_assessments ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.fitness_assessments ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Member profile change history.
CREATE TABLE public.member_profile_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_profile_history_member_idx ON public.member_profile_history (member_id, created_at DESC);
GRANT SELECT ON public.member_profile_history TO authenticated;
GRANT ALL ON public.member_profile_history TO service_role;
ALTER TABLE public.member_profile_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read member profile history" ON public.member_profile_history
  FOR SELECT TO authenticated
  USING (gym_id = public.current_gym_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(member_id)));
-- Writes only through staff_update_member_profile (security definer).

CREATE OR REPLACE FUNCTION public.staff_update_member_profile(
  _member_id uuid, _display_name text, _phone text, _dob date, _gender text,
  _experience_level text, _goals text, _health_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym uuid := public.current_gym_id();
  _u public.users%ROWTYPE;
  _p public.member_profiles%ROWTYPE;
  _changes jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR _gym IS NULL
     OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(_member_id)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _u FROM public.users WHERE id = _member_id AND gym_id = _gym FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found in your gym'; END IF;
  IF _display_name IS NULL OR length(btrim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  SELECT * INTO _p FROM public.member_profiles WHERE user_id = _member_id FOR UPDATE;

  IF _u.display_name IS DISTINCT FROM _display_name THEN _changes := _changes || jsonb_build_object('name', jsonb_build_array(_u.display_name, _display_name)); END IF;
  IF _u.phone IS DISTINCT FROM _phone THEN _changes := _changes || jsonb_build_object('phone', jsonb_build_array(_u.phone, _phone)); END IF;
  IF _p.dob IS DISTINCT FROM _dob THEN _changes := _changes || jsonb_build_object('date_of_birth', jsonb_build_array(_p.dob, _dob)); END IF;
  IF _p.gender IS DISTINCT FROM _gender THEN _changes := _changes || jsonb_build_object('gender', jsonb_build_array(_p.gender, _gender)); END IF;
  IF _p.experience_level IS DISTINCT FROM _experience_level THEN _changes := _changes || jsonb_build_object('experience_level', jsonb_build_array(_p.experience_level, _experience_level)); END IF;
  IF _p.goals IS DISTINCT FROM _goals THEN _changes := _changes || jsonb_build_object('goals', jsonb_build_array(_p.goals, _goals)); END IF;
  IF _p.health_notes IS DISTINCT FROM _health_notes THEN _changes := _changes || jsonb_build_object('medical_history', '["(changed)","(changed)"]'::jsonb); END IF;

  IF _changes = '{}'::jsonb THEN RETURN jsonb_build_object('changed', false); END IF;

  UPDATE public.users SET display_name = btrim(_display_name), phone = _phone WHERE id = _member_id;
  INSERT INTO public.member_profiles (user_id, dob, gender, experience_level, goals, health_notes)
  VALUES (_member_id, _dob, _gender, _experience_level, _goals, _health_notes)
  ON CONFLICT (user_id) DO UPDATE SET dob = EXCLUDED.dob, gender = EXCLUDED.gender,
    experience_level = EXCLUDED.experience_level, goals = EXCLUDED.goals, health_notes = EXCLUDED.health_notes;
  INSERT INTO public.member_profile_history (gym_id, member_id, changed_by, changes)
  VALUES (_gym, _member_id, auth.uid(), _changes);
  RETURN jsonb_build_object('changed', true, 'changes', _changes);
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_update_member_profile(uuid, text, text, date, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_member_profile(uuid, text, text, date, text, text, text, text) TO authenticated;