ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS tracking text NOT NULL DEFAULT 'weight_reps';
ALTER TABLE public.exercises ADD CONSTRAINT exercises_tracking_check CHECK (tracking IN ('weight_reps','reps','time'));
ALTER TABLE public.exercise_logs ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE public.exercise_logs ADD CONSTRAINT exercise_logs_duration_check CHECK (duration_seconds IS NULL OR (duration_seconds >= 0 AND duration_seconds <= 36000));

UPDATE public.exercises SET tracking = 'time'
WHERE name ~* '(plank|hold|hang|wall sit|l-sit|dead bug hold|hollow body|isometric|bridge hold|farmer)';
UPDATE public.exercises SET tracking = 'reps'
WHERE tracking = 'weight_reps'
  AND equipment IS NOT NULL
  AND cardinality(equipment) > 0
  AND equipment <@ ARRAY['bodyweight','pull-up bar','bench','trx','bands']::text[];

-- Members may upload their own progress photos into {gym}/{member}/...
CREATE POLICY "member photos self insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'member-photos'
  AND ((storage.foldername(name))[1])::uuid = public.current_gym_id()
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Progress photos are private to their member and the gym's staff.
DROP POLICY IF EXISTS "member photos same-gym read" ON storage.objects;
CREATE POLICY "member photos same-gym read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'member-photos'
  AND ((storage.foldername(name))[1])::uuid = public.current_gym_id()
  AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer')
    OR (storage.foldername(name))[2] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.progress_photos p WHERE p.photo_url = storage.objects.name AND p.member_id = auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.progress_photos p WHERE p.photo_url = storage.objects.name)
  )
);