-- One join-code format: 8 chars, unambiguous uppercase alphabet (no 0/O, 1/I).
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN out;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_join_code() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.gyms_set_join_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.join_code := public.generate_join_code();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS gyms_set_join_code ON public.gyms;
CREATE TRIGGER gyms_set_join_code BEFORE INSERT ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.gyms_set_join_code();

-- Case-insensitive, ignores spaces/dashes so "ABCD EFGH" and "abcd-efgh" both match.
CREATE OR REPLACE FUNCTION public.verify_join_code(_slug text, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gyms
    WHERE slug = lower(trim(_slug))
      AND join_code IS NOT NULL
      AND upper(regexp_replace(join_code, '[^A-Za-z0-9]', '', 'g'))
        = upper(regexp_replace(coalesce(_code, ''), '[^A-Za-z0-9]', '', 'g'))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.verify_join_code(text, text) FROM PUBLIC, anon, authenticated;

-- Gym-owner leads from /get-started.
CREATE TABLE public.platform_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 120),
  gym_name text NOT NULL CHECK (char_length(gym_name) BETWEEN 1 AND 120),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 80),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 5 AND 30),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  member_count text NOT NULL CHECK (member_count IN ('under_50','50_150','150_400','400_plus')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.platform_leads TO anon, authenticated;
GRANT SELECT, UPDATE ON public.platform_leads TO authenticated;
GRANT ALL ON public.platform_leads TO service_role;
ALTER TABLE public.platform_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit a lead" ON public.platform_leads FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new');
CREATE POLICY "platform admins read leads" ON public.platform_leads FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "platform admins update leads" ON public.platform_leads FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Basic flood guard: max 3 submissions per email per hour.
CREATE OR REPLACE FUNCTION public.platform_leads_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  IF (SELECT count(*) FROM public.platform_leads
      WHERE email = NEW.email AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Too many submissions — please try again later' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_leads_rate_limit() FROM PUBLIC, anon;
CREATE TRIGGER platform_leads_rate_limit BEFORE INSERT ON public.platform_leads
  FOR EACH ROW EXECUTE FUNCTION public.platform_leads_rate_limit();
CREATE TRIGGER platform_leads_updated_at BEFORE UPDATE ON public.platform_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();