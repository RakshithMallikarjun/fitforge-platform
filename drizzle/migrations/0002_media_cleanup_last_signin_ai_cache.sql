-- 1) Clear dead media links so the UI degrades to placeholders
UPDATE public.exercises
SET video_url = NULL, thumbnail_url = NULL
WHERE COALESCE(video_url, '') ILIKE '%fitforge.app%'
   OR COALESCE(thumbnail_url, '') ILIKE '%fitforge.app%';

-- 2) last_sign_in_at on public.users so the members page never lists platform users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

UPDATE public.users u
SET last_sign_in_at = a.last_sign_in_at
FROM auth.users a
WHERE a.id = u.id AND u.last_sign_in_at IS DISTINCT FROM a.last_sign_in_at;

CREATE OR REPLACE FUNCTION public.touch_last_sign_in()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users SET last_sign_in_at = now() WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.touch_last_sign_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_sign_in() TO authenticated;

-- 3) AI overload suggestion cache + per-user daily ceiling
CREATE TABLE IF NOT EXISTS public.ai_overload_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, cache_key)
);

CREATE INDEX IF NOT EXISTS ai_overload_cache_requested_by_created_idx
  ON public.ai_overload_cache (requested_by, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.ai_overload_cache TO authenticated;
GRANT ALL ON public.ai_overload_cache TO service_role;

ALTER TABLE public.ai_overload_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own or requested ai cache readable" ON public.ai_overload_cache;
CREATE POLICY "own or requested ai cache readable"
ON public.ai_overload_cache FOR SELECT TO authenticated
USING (requested_by = auth.uid() OR member_id = auth.uid());

DROP POLICY IF EXISTS "insert own ai cache" ON public.ai_overload_cache;
CREATE POLICY "insert own ai cache"
ON public.ai_overload_cache FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "delete own ai cache" ON public.ai_overload_cache;
CREATE POLICY "delete own ai cache"
ON public.ai_overload_cache FOR DELETE TO authenticated
USING (requested_by = auth.uid());