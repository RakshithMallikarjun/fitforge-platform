-- Rebrand: FitForge -> Fit Foundry, fitforge.app -> fitfoundry.in
-- Text/data only: no schema, policy or business-logic changes.

-- Any stored exercise media still pointing at the old asset hosts.
UPDATE public.exercises
SET
  video_url = replace(video_url, 'fitforge.app', 'fitfoundry.in'),
  thumbnail_url = replace(thumbnail_url, 'fitforge.app', 'fitfoundry.in')
WHERE COALESCE(video_url, '') ILIKE '%fitforge.app%'
   OR COALESCE(thumbnail_url, '') ILIKE '%fitforge.app%';

-- Gym-level support emails / custom domains that used the platform domain.
-- (Gym names, logos, colors and slugs are intentionally left untouched.)
UPDATE public.gyms
SET support_email = replace(support_email, 'fitforge.app', 'fitfoundry.in')
WHERE COALESCE(support_email, '') ILIKE '%fitforge.app%';

UPDATE public.gyms
SET custom_domain = replace(custom_domain, 'fitforge.app', 'fitfoundry.in')
WHERE COALESCE(custom_domain, '') ILIKE '%fitforge.app%';
