
-- =============== ENUMS ===============
CREATE TYPE public.app_role AS ENUM ('admin', 'trainer', 'member');
CREATE TYPE public.subscription_plan AS ENUM ('starter', 'growth', 'pro', 'chain');
CREATE TYPE public.plan_status AS ENUM ('active', 'archived');

-- =============== TABLES ===============
CREATE TABLE public.gyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#059669',
  font_family text DEFAULT 'Satoshi',
  custom_domain text,
  subscription_plan public.subscription_plan NOT NULL DEFAULT 'starter',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL,
  email text NOT NULL,
  display_name text,
  push_subscription jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_gym_id_idx ON public.users(gym_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
CREATE INDEX user_roles_user_idx ON public.user_roles(user_id);

CREATE TABLE public.member_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  dob date,
  gender text,
  health_notes text,
  goals text,
  emergency_contact jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trainer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(trainer_id, member_id)
);
CREATE INDEX trainer_assignments_member_idx ON public.trainer_assignments(member_id);
CREATE INDEX trainer_assignments_trainer_idx ON public.trainer_assignments(trainer_id);
CREATE INDEX trainer_assignments_gym_idx ON public.trainer_assignments(gym_id);

CREATE TABLE public.fitness_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight numeric, height numeric, bmi numeric,
  body_fat_pct numeric, muscle_mass numeric,
  waist numeric, chest numeric, hips numeric, arms numeric, thighs numeric,
  vo2_max numeric, resting_hr integer, blood_pressure text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fitness_assessments_member_idx ON public.fitness_assessments(member_id);
CREATE INDEX fitness_assessments_gym_idx ON public.fitness_assessments(gym_id);

CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  video_url text,
  thumbnail_url text,
  muscle_groups text[] DEFAULT '{}',
  equipment text[] DEFAULT '{}',
  difficulty text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercises_gym_idx ON public.exercises(gym_id);

CREATE TABLE public.workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  duration_weeks integer,
  status public.plan_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_plans_member_idx ON public.workout_plans(member_id);
CREATE INDEX workout_plans_gym_idx ON public.workout_plans(gym_id);

CREATE TABLE public.workout_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  day_label text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_days_plan_idx ON public.workout_days(plan_id);

CREATE TABLE public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.workout_days(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  sets integer, reps text, rest_seconds integer, tempo text, notes text,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_exercises_day_idx ON public.workout_exercises(day_id);

CREATE TABLE public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  workout_day_id uuid REFERENCES public.workout_days(id) ON DELETE SET NULL,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz,
  notes text,
  effort_rating integer,
  synced_offline boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_logs_member_idx ON public.workout_logs(member_id);
CREATE INDEX workout_logs_gym_idx ON public.workout_logs(gym_id);

CREATE TABLE public.exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  set_number integer NOT NULL,
  weight numeric,
  reps integer,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercise_logs_log_idx ON public.exercise_logs(log_id);

CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz
);
CREATE INDEX attendance_logs_member_idx ON public.attendance_logs(member_id);
CREATE INDEX attendance_logs_gym_idx ON public.attendance_logs(gym_id);

-- =============== GRANTS ===============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gyms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_logs TO authenticated;
GRANT ALL ON public.gyms, public.users, public.user_roles, public.member_profiles,
  public.trainer_assignments, public.fitness_assessments, public.exercises,
  public.workout_plans, public.workout_days, public.workout_exercises,
  public.workout_logs, public.exercise_logs, public.attendance_logs TO service_role;

-- =============== HELPER FUNCTIONS ===============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_gym_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gym_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_trainer_of(_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainer_assignments
    WHERE trainer_id = auth.uid() AND member_id = _member_id AND active = true
  );
$$;

-- =============== RLS ===============
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their gym" ON public.gyms FOR SELECT TO authenticated
  USING (id = public.current_gym_id());
CREATE POLICY "Admins manage their gym" ON public.gyms FOR UPDATE TO authenticated
  USING (id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read same gym" ON public.users FOR SELECT TO authenticated
  USING (gym_id = public.current_gym_id() OR id = auth.uid());
CREATE POLICY "Users update self" ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Admins manage gym users" ON public.users FOR ALL TO authenticated
  USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins manage gym roles" ON public.user_roles FOR ALL TO authenticated
  USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member profile access" ON public.member_profiles FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_trainer_of(user_id)
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_trainer_of(user_id)
    OR public.has_role(auth.uid(), 'admin')
  );

ALTER TABLE public.trainer_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assignment visibility" ON public.trainer_assignments FOR SELECT TO authenticated
  USING (
    gym_id = public.current_gym_id() AND (
      trainer_id = auth.uid() OR member_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    )
  );
CREATE POLICY "Admin manages assignments" ON public.trainer_assignments FOR ALL TO authenticated
  USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.fitness_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessment access" ON public.fitness_assessments FOR ALL TO authenticated
  USING (
    gym_id = public.current_gym_id() AND (
      member_id = auth.uid()
      OR public.is_trainer_of(member_id)
      OR public.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    gym_id = public.current_gym_id() AND (
      public.is_trainer_of(member_id)
      OR public.has_role(auth.uid(), 'admin')
    )
  );

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read exercises (gym + global)" ON public.exercises FOR SELECT TO authenticated
  USING (gym_id IS NULL OR gym_id = public.current_gym_id());
CREATE POLICY "Trainers/admins create exercises" ON public.exercises FOR INSERT TO authenticated
  WITH CHECK (
    gym_id = public.current_gym_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
  );
CREATE POLICY "Trainers/admins update gym exercises" ON public.exercises FOR UPDATE TO authenticated
  USING (
    gym_id = public.current_gym_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
  );
CREATE POLICY "Admins delete gym exercises" ON public.exercises FOR DELETE TO authenticated
  USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workout plan access" ON public.workout_plans FOR ALL TO authenticated
  USING (
    gym_id = public.current_gym_id() AND (
      member_id = auth.uid()
      OR public.is_trainer_of(member_id)
      OR public.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    gym_id = public.current_gym_id() AND (
      public.is_trainer_of(member_id) OR public.has_role(auth.uid(), 'admin')
    )
  );

ALTER TABLE public.workout_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workout day access" ON public.workout_days FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workout_plans wp WHERE wp.id = plan_id
      AND wp.gym_id = public.current_gym_id()
      AND (wp.member_id = auth.uid() OR public.is_trainer_of(wp.member_id) OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_plans wp WHERE wp.id = plan_id
      AND wp.gym_id = public.current_gym_id()
      AND (public.is_trainer_of(wp.member_id) OR public.has_role(auth.uid(), 'admin'))
  ));

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workout exercise access" ON public.workout_exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workout_days wd
    JOIN public.workout_plans wp ON wp.id = wd.plan_id
    WHERE wd.id = day_id AND wp.gym_id = public.current_gym_id()
      AND (wp.member_id = auth.uid() OR public.is_trainer_of(wp.member_id) OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_days wd
    JOIN public.workout_plans wp ON wp.id = wd.plan_id
    WHERE wd.id = day_id AND wp.gym_id = public.current_gym_id()
      AND (public.is_trainer_of(wp.member_id) OR public.has_role(auth.uid(), 'admin'))
  ));

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workout log access" ON public.workout_logs FOR ALL TO authenticated
  USING (
    gym_id = public.current_gym_id() AND (
      member_id = auth.uid()
      OR public.is_trainer_of(member_id)
      OR public.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    gym_id = public.current_gym_id() AND member_id = auth.uid()
  );

ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exercise log access" ON public.exercise_logs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workout_logs wl WHERE wl.id = log_id
      AND wl.gym_id = public.current_gym_id()
      AND (wl.member_id = auth.uid() OR public.is_trainer_of(wl.member_id) OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_logs wl WHERE wl.id = log_id AND wl.member_id = auth.uid()
  ));

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance access" ON public.attendance_logs FOR SELECT TO authenticated
  USING (
    gym_id = public.current_gym_id() AND (
      member_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer')
    )
  );
CREATE POLICY "Member self check-in" ON public.attendance_logs FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() AND gym_id = public.current_gym_id());
CREATE POLICY "Member self check-out" ON public.attendance_logs FOR UPDATE TO authenticated
  USING (member_id = auth.uid());

-- =============== AUTH TRIGGER ===============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym_id uuid;
  _gym_slug text := NEW.raw_user_meta_data ->> 'gym_slug';
  _role public.app_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'member');
  _display_name text := COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1));
BEGIN
  IF _gym_slug IS NOT NULL THEN
    SELECT id INTO _gym_id FROM public.gyms WHERE slug = _gym_slug;
  END IF;

  INSERT INTO public.users (id, gym_id, email, display_name)
  VALUES (NEW.id, _gym_id, NEW.email, _display_name);

  INSERT INTO public.user_roles (user_id, gym_id, role)
  VALUES (NEW.id, _gym_id, _role);

  IF _role = 'member' THEN
    INSERT INTO public.member_profiles (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============== SEED DEFAULT GYM ===============
INSERT INTO public.gyms (name, slug, primary_color, font_family)
VALUES ('FitForge Demo', 'fitforge', '#059669', 'Satoshi');
