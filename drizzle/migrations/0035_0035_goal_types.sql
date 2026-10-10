ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metric text,
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'up',
  ADD COLUMN IF NOT EXISTS start_value numeric(12,2);
ALTER TABLE public.goals ADD CONSTRAINT goals_goal_type_check CHECK (goal_type IN ('strength','body','attendance','custom'));
ALTER TABLE public.goals ADD CONSTRAINT goals_direction_check CHECK (direction IN ('up','down'));
ALTER TABLE public.goals ADD CONSTRAINT goals_metric_check CHECK (metric IS NULL OR metric IN ('weight','body_fat_pct','muscle_mass','waist','chest','hips','arms','thighs'));