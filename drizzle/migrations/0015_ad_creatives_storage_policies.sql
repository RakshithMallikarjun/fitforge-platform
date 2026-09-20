-- Storage policies for the private `ad-creatives` bucket.
-- Keys are `{gym_id}/{ad_id}/{filename}` for gym ads, `platform/{ad_id}/{filename}`
-- for platform campaigns. Members need SELECT so a signed URL can be minted for
-- creatives that belong to their own gym (or the platform inventory).
DROP POLICY IF EXISTS ad_creatives_read ON storage.objects;
CREATE POLICY ad_creatives_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ad-creatives'
  AND (
    (storage.foldername(name))[1] = 'platform'
    OR (storage.foldername(name))[1] = public.current_gym_id()::text
  )
);

DROP POLICY IF EXISTS ad_creatives_write ON storage.objects;
CREATE POLICY ad_creatives_write ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ad-creatives'
  AND (
    ((storage.foldername(name))[1] = public.current_gym_id()::text
      AND public.has_role(auth.uid(), 'admin'))
    OR ((storage.foldername(name))[1] = 'platform' AND public.is_platform_admin())
  )
);

DROP POLICY IF EXISTS ad_creatives_update ON storage.objects;
CREATE POLICY ad_creatives_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ad-creatives'
  AND (
    ((storage.foldername(name))[1] = public.current_gym_id()::text
      AND public.has_role(auth.uid(), 'admin'))
    OR ((storage.foldername(name))[1] = 'platform' AND public.is_platform_admin())
  )
)
WITH CHECK (
  bucket_id = 'ad-creatives'
  AND (
    ((storage.foldername(name))[1] = public.current_gym_id()::text
      AND public.has_role(auth.uid(), 'admin'))
    OR ((storage.foldername(name))[1] = 'platform' AND public.is_platform_admin())
  )
);

DROP POLICY IF EXISTS ad_creatives_delete ON storage.objects;
CREATE POLICY ad_creatives_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ad-creatives'
  AND (
    ((storage.foldername(name))[1] = public.current_gym_id()::text
      AND public.has_role(auth.uid(), 'admin'))
    OR ((storage.foldername(name))[1] = 'platform' AND public.is_platform_admin())
  )
);
