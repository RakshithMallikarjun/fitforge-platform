
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gym_id uuid;
  _gym_slug text := NEW.raw_user_meta_data ->> 'gym_slug';
  _display_name text := COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1));
BEGIN
  IF _gym_slug IS NOT NULL THEN
    SELECT id INTO _gym_id FROM public.gyms WHERE slug = _gym_slug;
  END IF;

  INSERT INTO public.users (id, gym_id, email, display_name)
  VALUES (NEW.id, _gym_id, NEW.email, _display_name);

  INSERT INTO public.user_roles (user_id, gym_id, role)
  VALUES (NEW.id, _gym_id, 'member');

  INSERT INTO public.member_profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "member photos auth read" ON storage.objects;
DROP POLICY IF EXISTS "member photos staff insert" ON storage.objects;
DROP POLICY IF EXISTS "member photos staff update" ON storage.objects;
DROP POLICY IF EXISTS "member photos staff delete" ON storage.objects;

CREATE POLICY "member photos same-gym read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'member-photos'
         AND (storage.foldername(name))[1]::uuid = public.current_gym_id());

CREATE POLICY "member photos staff insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'member-photos'
    AND (storage.foldername(name))[1]::uuid = public.current_gym_id()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')));

CREATE POLICY "member photos staff update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'member-photos'
    AND (storage.foldername(name))[1]::uuid = public.current_gym_id()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')));

CREATE POLICY "member photos staff delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'member-photos'
    AND (storage.foldername(name))[1]::uuid = public.current_gym_id()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')));
