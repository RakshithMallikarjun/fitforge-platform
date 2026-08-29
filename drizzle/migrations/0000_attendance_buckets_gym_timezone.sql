-- Bucket attendance by calendar day and hour-of-day in the GYM's timezone,
-- so reports match the gym's local day and the peak-hours chart is correct.
CREATE OR REPLACE FUNCTION public.attendance_buckets(
  _gym_id uuid,
  _start date,
  _end date
)
RETURNS TABLE (day date, hour integer, member_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    ((a.check_in_at AT TIME ZONE g.timezone))::date AS day,
    EXTRACT(hour FROM (a.check_in_at AT TIME ZONE g.timezone))::int AS hour,
    a.member_id,
    count(*) AS cnt
  FROM public.attendance_logs a
  JOIN public.gyms g ON g.id = a.gym_id
  WHERE a.gym_id = _gym_id
    AND ((a.check_in_at AT TIME ZONE g.timezone))::date BETWEEN _start AND _end
  GROUP BY 1, 2, 3
$$;

GRANT EXECUTE ON FUNCTION public.attendance_buckets(uuid, date, date) TO authenticated;