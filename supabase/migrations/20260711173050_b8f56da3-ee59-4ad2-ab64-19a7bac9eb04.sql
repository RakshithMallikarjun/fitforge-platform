ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS location_type text
    CHECK (location_type IN ('gym','home')) DEFAULT 'gym';