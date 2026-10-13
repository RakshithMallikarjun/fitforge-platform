CREATE TABLE public.scheduler_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.scheduler_config TO service_role;
ALTER TABLE public.scheduler_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access" ON public.scheduler_config FOR SELECT TO authenticated USING (false);
INSERT INTO public.scheduler_config DEFAULT VALUES ON CONFLICT DO NOTHING;