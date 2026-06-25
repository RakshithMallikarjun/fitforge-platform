
CREATE POLICY "member photos auth read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'member-photos');

CREATE POLICY "member photos staff insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'member-photos'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
  );

CREATE POLICY "member photos staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
  );

CREATE POLICY "member photos staff delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer'))
  );
