-- One row per set: de-duplicate existing rows (keep the latest per key), then enforce uniqueness.
DELETE FROM public.exercise_logs a
USING public.exercise_logs b
WHERE a.log_id = b.log_id
  AND a.exercise_id = b.exercise_id
  AND a.set_number = b.set_number
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

CREATE UNIQUE INDEX exercise_logs_log_exercise_set_key
  ON public.exercise_logs (log_id, exercise_id, set_number);