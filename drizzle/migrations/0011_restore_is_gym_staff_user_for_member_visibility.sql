-- The "Members read gym staff" policy on public.users calls
-- is_gym_staff_user(users.id) with a row id rather than auth.uid(), so the
-- self-or-staff guard added in the previous migration would stop ordinary
-- members from seeing their trainer's profile row. This predicate only reveals
-- whether a same-gym user is staff, so restore the original scoped body.
CREATE OR REPLACE FUNCTION public.is_gym_staff_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.users u ON u.id = r.user_id
    WHERE r.user_id = _user_id
      AND r.role IN ('admin', 'trainer')
      AND r.gym_id = public.current_gym_id()
      AND u.gym_id = public.current_gym_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_gym_staff_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gym_staff_user(uuid) TO authenticated, service_role;
