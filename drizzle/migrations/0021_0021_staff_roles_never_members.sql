-- Staff (admin/trainer) in a gym never also hold the 'member' role there.

CREATE OR REPLACE FUNCTION public.user_roles_staff_excludes_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'member' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles r
               WHERE r.user_id = NEW.user_id AND r.gym_id IS NOT DISTINCT FROM NEW.gym_id
                 AND r.role IN ('admin','trainer')) THEN
      RETURN NULL; -- silently skip: staff are not members
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.user_roles_staff_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IN ('admin','trainer') THEN
    DELETE FROM public.user_roles
     WHERE user_id = NEW.user_id AND gym_id IS NOT DISTINCT FROM NEW.gym_id AND role = 'member';
    DELETE FROM public.member_profiles WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.user_roles_staff_excludes_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_roles_staff_cleanup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_roles_staff_excludes_member ON public.user_roles;
CREATE TRIGGER user_roles_staff_excludes_member BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.user_roles_staff_excludes_member();
DROP TRIGGER IF EXISTS user_roles_staff_cleanup ON public.user_roles;
CREATE TRIGGER user_roles_staff_cleanup AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.user_roles_staff_cleanup();

-- Admin of the caller's gym grants a staff role to a user of the same gym (one transaction).
CREATE OR REPLACE FUNCTION public.staff_assign_role(_user_id uuid, _role app_role, _display_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _gym uuid := public.current_gym_id();
BEGIN
  IF auth.uid() IS NULL OR _gym IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND gym_id = _gym AND role = 'admin')
  THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  IF _role NOT IN ('admin','trainer') THEN RAISE EXCEPTION 'Invalid staff role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = _user_id AND gym_id = _gym) THEN
    RAISE EXCEPTION 'User is not in your gym';
  END IF;
  INSERT INTO public.user_roles (user_id, gym_id, role) VALUES (_user_id, _gym, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  -- covers the idempotent re-invite case where the role already existed
  DELETE FROM public.user_roles WHERE user_id = _user_id AND gym_id = _gym AND role = 'member';
  DELETE FROM public.member_profiles WHERE user_id = _user_id;
  IF _display_name IS NOT NULL AND length(trim(_display_name)) > 0 THEN
    UPDATE public.users SET display_name = trim(_display_name) WHERE id = _user_id;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_assign_role(uuid, app_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_assign_role(uuid, app_role, text) TO authenticated;

-- One-off repair.
INSERT INTO public.user_roles (user_id, gym_id, role)
SELECT u.id, g.id, 'trainer' FROM public.users u JOIN public.gyms g ON g.id = u.gym_id
 WHERE lower(u.email) = 'rakshith.mallikarjun+fftrainer@gmail.com' AND g.slug = 'fitforge'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.member_profiles mp
 WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = mp.user_id AND r.role IN ('admin','trainer'));
DELETE FROM public.user_roles m
 WHERE m.role = 'member' AND EXISTS (
   SELECT 1 FROM public.user_roles r WHERE r.user_id = m.user_id
     AND r.gym_id IS NOT DISTINCT FROM m.gym_id AND r.role IN ('admin','trainer'));