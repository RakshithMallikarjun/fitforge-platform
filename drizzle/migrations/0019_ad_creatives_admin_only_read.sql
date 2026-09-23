-- Narrow reads on the private ad-creatives bucket.
-- Members' creative URLs are signed server-side with the service-role client,
-- using only paths returned by the guarded ad_serve() RPC, so members no longer
-- need direct SELECT. Gym admins keep their own gym folder plus the shared
-- 'platform' folder (for the platform-ads preview); platform admins keep both.

DROP POLICY IF EXISTS ad_creatives_read ON storage.objects;

CREATE POLICY ad_creatives_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ad-creatives'
    AND (
      (
        (storage.foldername(name))[1] = (public.current_gym_id())::text
        AND public.has_role(auth.uid(), 'admin'::public.app_role)
      )
      OR (
        (storage.foldername(name))[1] = 'platform'
        AND (
          public.is_platform_admin()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
      )
    )
  );
