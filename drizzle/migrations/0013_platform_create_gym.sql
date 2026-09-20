-- ============================================================================
-- 0013 platform_create_gym
-- Lets a platform admin provision a gym and invite its owner from the console.
-- ============================================================================

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS pending_owner_email text,
  ADD COLUMN IF NOT EXISTS owner_invited_at    timestamptz,
  ADD COLUMN IF NOT EXISTS owner_claimed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS created_by          uuid REFERENCES auth.users(id);

-- ============ slug validation (shared by the RPC and the console) ============
CREATE OR REPLACE FUNCTION public.is_valid_gym_slug(_slug text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _slug ~ '^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$'
     AND _slug NOT LIKE '%--%'
     AND _slug NOT IN (
       'app','admin','platform','api','www','auth','mail','static','assets','cdn','support',
       'help','billing','status','docs','blog','new','signup','login','account','settings'
     )
$$;
REVOKE EXECUTE ON FUNCTION public.is_valid_gym_slug(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_valid_gym_slug(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_valid_gym_slug(text) TO authenticated;

-- ============ slug availability (platform-admin only, not a public oracle) ====
CREATE OR REPLACE FUNCTION public.platform_slug_available(_slug text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  _s := lower(btrim(COALESCE(_slug, '')));
  RETURN public.is_valid_gym_slug(_s)
     AND NOT EXISTS (SELECT 1 FROM public.gyms g WHERE g.slug = _s);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_slug_available(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_slug_available(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_slug_available(text) TO authenticated;

-- ============ create gym ============
CREATE OR REPLACE FUNCTION public.platform_create_gym(
  _name text,
  _slug text,
  _timezone text DEFAULT 'Asia/Kolkata',
  _currency text DEFAULT 'INR',
  _owner_email text DEFAULT NULL,
  _subscription_plan public.subscription_plan DEFAULT 'starter',
  _primary_color text DEFAULT NULL,
  _support_email text DEFAULT NULL,
  _support_phone text DEFAULT NULL,
  _internal_note text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s     text;
  _name2 text;
  _email text;
  _cur   text;
  _id    uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  _name2 := btrim(COALESCE(_name, ''));
  IF length(_name2) = 0 OR length(_name2) > 80 THEN
    RAISE EXCEPTION 'Gym name must be 1-80 characters';
  END IF;

  _s := lower(btrim(COALESCE(_slug, '')));
  IF NOT public.is_valid_gym_slug(_s) THEN
    RAISE EXCEPTION 'Invalid gym code';
  END IF;

  IF EXISTS (SELECT 1 FROM public.gyms g WHERE g.slug = _s) THEN
    RAISE EXCEPTION 'That gym code is taken';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names t WHERE t.name = _timezone) THEN
    RAISE EXCEPTION 'Unknown timezone: %', COALESCE(_timezone, '(none)');
  END IF;

  _cur := upper(btrim(COALESCE(_currency, 'INR')));
  IF _cur !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Currency must be a 3-letter code';
  END IF;

  _email := NULLIF(lower(btrim(COALESCE(_owner_email, ''))), '');
  IF _email IS NOT NULL AND _email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid owner email';
  END IF;

  IF _primary_color IS NOT NULL AND btrim(_primary_color) <> ''
     AND btrim(_primary_color) !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Primary colour must be a #rrggbb value';
  END IF;

  BEGIN
    INSERT INTO public.gyms (
      name, slug, timezone, currency, subscription_plan, primary_color,
      support_email, support_phone, internal_note,
      is_enabled, payment_status, join_code, pending_owner_email, created_by
    ) VALUES (
      _name2, _s, _timezone, _cur, _subscription_plan,
      NULLIF(btrim(COALESCE(_primary_color, '')), ''),
      NULLIF(btrim(COALESCE(_support_email, '')), ''),
      NULLIF(btrim(COALESCE(_support_phone, '')), ''),
      NULLIF(btrim(COALESCE(_internal_note, '')), ''),
      true, 'trialing', upper(substr(md5(gen_random_uuid()::text), 1, 6)), _email, auth.uid()
    ) RETURNING id INTO _id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That gym code is taken';
  END;

  INSERT INTO public.platform_audit_log (actor_id, action, gym_id, detail)
  VALUES (auth.uid(), 'create_gym', _id, jsonb_build_object(
    'name', _name2, 'slug', _s, 'timezone', _timezone, 'currency', _cur,
    'plan', _subscription_plan, 'owner_email', _email));

  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_create_gym(text, text, text, text, text, public.subscription_plan, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_create_gym(text, text, text, text, text, public.subscription_plan, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_create_gym(text, text, text, text, text, public.subscription_plan, text, text, text, text) TO authenticated;

-- ============ mark owner invited ============
CREATE OR REPLACE FUNCTION public.platform_mark_owner_invited(_gym_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email2 text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  _email2 := NULLIF(lower(btrim(COALESCE(_email, ''))), '');
  IF _email2 IS NULL OR _email2 !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid owner email';
  END IF;

  UPDATE public.gyms
     SET pending_owner_email = _email2, owner_invited_at = now()
   WHERE id = _gym_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gym not found';
  END IF;

  INSERT INTO public.platform_audit_log (actor_id, action, gym_id, detail)
  VALUES (auth.uid(), 'invite_gym_owner', _gym_id, jsonb_build_object('owner_email', _email2));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_mark_owner_invited(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_mark_owner_invited(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_mark_owner_invited(uuid, text) TO authenticated;

-- ============ owner_claimed_at bookkeeping ============
CREATE OR REPLACE FUNCTION public.mark_gym_owner_claimed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin' AND NEW.gym_id IS NOT NULL THEN
    UPDATE public.gyms
       SET owner_claimed_at = COALESCE(owner_claimed_at, now())
     WHERE id = NEW.gym_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_gym_owner_claimed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_gym_owner_claimed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_gym_owner_claimed() FROM authenticated;

DROP TRIGGER IF EXISTS user_roles_mark_owner_claimed ON public.user_roles;
CREATE TRIGGER user_roles_mark_owner_claimed
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.mark_gym_owner_claimed();

-- ============ expose invite state to the console ============
CREATE OR REPLACE FUNCTION public.platform_gym_detail(_gym_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(pg) INTO result FROM public.platform_gyms() pg WHERE pg.id = _gym_id;
  IF result IS NULL THEN RETURN NULL; END IF;

  result := result
    || (SELECT jsonb_build_object(
          'billing_email', g.billing_email,
          'support_email', g.support_email,
          'support_phone', g.support_phone,
          'internal_note', g.internal_note,
          'disabled_reason', g.disabled_reason,
          'pending_owner_email', g.pending_owner_email,
          'owner_invited_at', g.owner_invited_at,
          'owner_claimed_at', g.owner_claimed_at)
        FROM public.gyms g WHERE g.id = _gym_id)
    || jsonb_build_object('staff', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'user_id', u.id, 'display_name', u.display_name, 'email', u.email,
                 'phone', u.phone, 'role', r.role, 'active', u.active,
                 'last_sign_in_at', u.last_sign_in_at)
               ORDER BY (r.role <> 'admin'), u.display_name)
        FROM public.users u JOIN public.user_roles r ON r.user_id = u.id
        WHERE r.gym_id = _gym_id AND r.role IN ('admin','trainer')), '[]'::jsonb));

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_gym_detail(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_gym_detail(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_gym_detail(uuid) TO authenticated;
