-- Records the built-in exercise fixes used by bodyweight-aware substitutions.
UPDATE public.exercises
   SET equipment = (SELECT array_agg(DISTINCT e) FROM unnest(array_append(equipment, 'bodyweight')) e)
 WHERE gym_id IS NULL AND name IN ('Pull Up', 'Hanging Leg Raise')
   AND NOT ('bodyweight' = ANY(equipment));
UPDATE public.exercises SET tracking = 'reps'
 WHERE gym_id IS NULL AND name = 'Hanging Leg Raise' AND tracking = 'time';
DELETE FROM public.exercise_logs WHERE log_id = 'b9df9af4-c150-4c8d-98fb-95fc407ed9f5';
DELETE FROM public.workout_logs WHERE id = 'b9df9af4-c150-4c8d-98fb-95fc407ed9f5';