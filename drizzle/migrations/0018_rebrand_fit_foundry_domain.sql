-- Rebrand: fitforge.app -> fitfoundry.in (data only; no schema/policy changes).
UPDATE public.exercises
SET
  video_url = replace(video_url, 'fitforge.app', 'fitfoundry.in'),
  thumbnail_url = replace(thumbnail_url, 'fitforge.app', 'fitfoundry.in')
WHERE COALESCE(video_url, '') ILIKE '%fitforge.app%'
   OR COALESCE(thumbnail_url, '') ILIKE '%fitforge.app%';

UPDATE public.gyms
SET support_email = replace(support_email, 'fitforge.app', 'fitfoundry.in')
WHERE COALESCE(support_email, '') ILIKE '%fitforge.app%';

UPDATE public.gyms
SET custom_domain = replace(custom_domain, 'fitforge.app', 'fitfoundry.in')
WHERE COALESCE(custom_domain, '') ILIKE '%fitforge.app%';