-- Templates are not owned by a member. Allow member_id to be NULL so that
-- reusable templates no longer have to be stored against the creating trainer,
-- which made trainers appear as their own members in unfiltered queries.
ALTER TABLE public.workout_plans ALTER COLUMN member_id DROP NOT NULL;