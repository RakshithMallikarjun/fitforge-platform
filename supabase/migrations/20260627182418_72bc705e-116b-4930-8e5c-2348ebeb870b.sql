ALTER TABLE public.fitness_assessments
  ADD COLUMN IF NOT EXISTS flexibility numeric,
  ADD COLUMN IF NOT EXISTS bench_1rm numeric,
  ADD COLUMN IF NOT EXISTS squat_1rm numeric,
  ADD COLUMN IF NOT EXISTS deadlift_1rm numeric,
  ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'metric'
    CHECK (unit_system IN ('metric', 'imperial'));