CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND gym_id = public.current_gym_id()
  );
$$;

DROP POLICY IF EXISTS "Workout log access" ON public.workout_logs;
CREATE POLICY "Workout log access" ON public.workout_logs FOR ALL TO authenticated
USING (gym_id = public.current_gym_id() AND (member_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(member_id)))
WITH CHECK (gym_id = public.current_gym_id() AND (member_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(member_id)));

DROP POLICY IF EXISTS "Exercise log access" ON public.exercise_logs;
CREATE POLICY "Exercise log access" ON public.exercise_logs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = exercise_logs.log_id AND wl.gym_id = public.current_gym_id() AND (wl.member_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(wl.member_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = exercise_logs.log_id AND wl.gym_id = public.current_gym_id() AND (wl.member_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(wl.member_id))));

DROP POLICY IF EXISTS "Member profile access" ON public.member_profiles;
CREATE POLICY "Member profile access" ON public.member_profiles FOR ALL TO authenticated
USING ((user_id = auth.uid() OR public.is_trainer_of(user_id) OR public.has_role(auth.uid(),'admin')) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = member_profiles.user_id AND u.gym_id = public.current_gym_id()))
WITH CHECK ((user_id = auth.uid() OR public.is_trainer_of(user_id) OR public.has_role(auth.uid(),'admin')) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = member_profiles.user_id AND u.gym_id = public.current_gym_id()));

DROP POLICY IF EXISTS "member/trainer/admin access" ON public.personal_records;
CREATE POLICY "member/trainer/admin access" ON public.personal_records FOR ALL TO authenticated
USING ((member_id = auth.uid() OR public.is_trainer_of(member_id) OR public.has_role(auth.uid(),'admin')) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = personal_records.member_id AND u.gym_id = public.current_gym_id()))
WITH CHECK ((member_id = auth.uid() OR public.is_trainer_of(member_id) OR public.has_role(auth.uid(),'admin')) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = personal_records.member_id AND u.gym_id = public.current_gym_id()));

DROP POLICY IF EXISTS "member/trainer/admin access" ON public.progress_photos;
CREATE POLICY "member/trainer/admin access" ON public.progress_photos FOR ALL TO authenticated
USING ((member_id = auth.uid() OR public.is_trainer_of(member_id) OR public.has_role(auth.uid(),'admin')) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = progress_photos.member_id AND u.gym_id = public.current_gym_id()))
WITH CHECK ((member_id = auth.uid() OR public.is_trainer_of(member_id) OR public.has_role(auth.uid(),'admin')) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = progress_photos.member_id AND u.gym_id = public.current_gym_id()));

DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (gym_id = public.current_gym_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))));

ALTER TABLE public.gyms ADD COLUMN IF NOT EXISTS join_code text;
UPDATE public.gyms SET join_code = encode(gen_random_bytes(6),'hex') WHERE join_code IS NULL;

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS support_phone text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

UPDATE public.gyms SET timezone = 'Asia/Kolkata';

CREATE OR REPLACE FUNCTION public.verify_join_code(_slug text, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.gyms WHERE slug = _slug AND join_code = _code);
$$;
REVOKE EXECUTE ON FUNCTION public.verify_join_code(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_join_code(text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym_id uuid;
  _gym_slug text := NEW.raw_user_meta_data ->> 'gym_slug';
  _display_name text := COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1));
BEGIN
  IF _gym_slug IS NOT NULL THEN
    SELECT id INTO _gym_id FROM public.gyms WHERE slug = _gym_slug;
  END IF;

  IF _gym_slug IS NULL OR _gym_id IS NULL THEN
    RAISE EXCEPTION 'Unknown gym code: %', COALESCE(_gym_slug, '(none)');
  END IF;

  INSERT INTO public.users (id, gym_id, email, display_name)
  VALUES (NEW.id, _gym_id, NEW.email, _display_name);

  INSERT INTO public.user_roles (user_id, gym_id, role)
  VALUES (NEW.id, _gym_id, 'member');

  INSERT INTO public.member_profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DELETE FROM public.attendance_logs a USING public.attendance_logs b
WHERE a.member_id = b.member_id
  AND (a.check_in_at AT TIME ZONE 'UTC')::date = (b.check_in_at AT TIME ZONE 'UTC')::date
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_logs_member_day_uidx
  ON public.attendance_logs (member_id, ((check_in_at AT TIME ZONE 'UTC')::date));

DROP POLICY IF EXISTS "Workout plan access" ON public.workout_plans;
CREATE POLICY "Workout plan access" ON public.workout_plans FOR ALL TO authenticated
USING (gym_id = public.current_gym_id() AND (member_id = auth.uid() OR member_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(member_id)))
WITH CHECK (gym_id = public.current_gym_id() AND (member_id = auth.uid() OR member_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(member_id)));

DROP POLICY IF EXISTS "Workout plan read (gym staff)" ON public.workout_plans;
CREATE POLICY "Workout plan read (gym staff)" ON public.workout_plans FOR SELECT TO authenticated
USING (gym_id = public.current_gym_id() AND (public.has_role(auth.uid(),'admin') OR member_id IS NULL OR public.is_trainer_of(member_id)));

DROP POLICY IF EXISTS "Workout day access" ON public.workout_days;
CREATE POLICY "Workout day access" ON public.workout_days FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workout_plans p WHERE p.id = workout_days.plan_id AND p.gym_id = public.current_gym_id() AND (p.member_id = auth.uid() OR p.member_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(p.member_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.workout_plans p WHERE p.id = workout_days.plan_id AND p.gym_id = public.current_gym_id() AND (p.member_id = auth.uid() OR p.member_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(p.member_id))));

DROP POLICY IF EXISTS "Workout day read (gym staff)" ON public.workout_days;
CREATE POLICY "Workout day read (gym staff)" ON public.workout_days FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workout_plans wp WHERE wp.id = workout_days.plan_id AND wp.gym_id = public.current_gym_id() AND (public.has_role(auth.uid(),'admin') OR wp.member_id IS NULL OR public.is_trainer_of(wp.member_id))));

DROP POLICY IF EXISTS "Workout exercise access" ON public.workout_exercises;
CREATE POLICY "Workout exercise access" ON public.workout_exercises FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workout_days d JOIN public.workout_plans p ON p.id = d.plan_id WHERE d.id = workout_exercises.day_id AND p.gym_id = public.current_gym_id() AND (p.member_id = auth.uid() OR p.member_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(p.member_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.workout_days d JOIN public.workout_plans p ON p.id = d.plan_id WHERE d.id = workout_exercises.day_id AND p.gym_id = public.current_gym_id() AND (p.member_id = auth.uid() OR p.member_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_trainer_of(p.member_id))));

DROP POLICY IF EXISTS "Workout exercise read (gym staff)" ON public.workout_exercises;
CREATE POLICY "Workout exercise read (gym staff)" ON public.workout_exercises FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workout_days wd JOIN public.workout_plans wp ON wp.id = wd.plan_id WHERE wd.id = workout_exercises.day_id AND wp.gym_id = public.current_gym_id() AND (public.has_role(auth.uid(),'admin') OR wp.member_id IS NULL OR public.is_trainer_of(wp.member_id))));