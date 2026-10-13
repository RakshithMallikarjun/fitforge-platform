CREATE TABLE public.scheduled_job_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  gyms_processed integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  error text,
  results jsonb
);
CREATE INDEX scheduled_job_runs_job_started ON public.scheduled_job_runs (job, started_at DESC);
GRANT ALL ON public.scheduled_job_runs TO service_role;
ALTER TABLE public.scheduled_job_runs ENABLE ROW LEVEL SECURITY;
-- Audit-style table: written by the scheduler (service role) only, read via platform_job_runs().
CREATE POLICY "no direct access" ON public.scheduled_job_runs FOR SELECT TO authenticated USING (false);

CREATE TABLE public.dues_digest_log (
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  pushed integer NOT NULL DEFAULT 0,
  reminded integer NOT NULL DEFAULT 0,
  skipped_reason text,
  PRIMARY KEY (gym_id, digest_date)
);
GRANT ALL ON public.dues_digest_log TO service_role;
ALTER TABLE public.dues_digest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access" ON public.dues_digest_log FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.platform_job_runs(_gym_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'runs', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'job') FROM (
      SELECT DISTINCT ON (job) jsonb_build_object('job', job, 'started_at', started_at, 'finished_at', finished_at,
        'gyms_processed', gyms_processed, 'sent_count', sent_count, 'error', error,
        'gym_result', CASE WHEN _gym_id IS NULL THEN NULL ELSE (SELECT e FROM jsonb_array_elements(COALESCE(results,'[]'::jsonb)) e WHERE e->>'gym_id' = _gym_id::text LIMIT 1) END) x, job
      FROM public.scheduled_job_runs ORDER BY job, started_at DESC) s), '[]'::jsonb),
    'summary_log', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', summary_date, 'sent_at', sent_at, 'recipients', recipient_count, 'skipped_reason', skipped_reason) ORDER BY summary_date DESC)
      FROM (SELECT * FROM public.daily_summary_log WHERE _gym_id IS NOT NULL AND gym_id = _gym_id ORDER BY summary_date DESC LIMIT 7) d), '[]'::jsonb),
    'digest_log', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', digest_date, 'sent_at', sent_at, 'pushed', pushed, 'reminded', reminded, 'skipped_reason', skipped_reason) ORDER BY digest_date DESC)
      FROM (SELECT * FROM public.dues_digest_log WHERE _gym_id IS NOT NULL AND gym_id = _gym_id ORDER BY digest_date DESC LIMIT 7) d), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.platform_job_runs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_job_runs(uuid) TO authenticated;