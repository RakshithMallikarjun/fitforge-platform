-- ============ 0017 Membership tiers, payment ledger, dues engine ============
DO $$ BEGIN CREATE TYPE public.billing_period AS ENUM ('monthly','quarterly','half_yearly','annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.subscription_state AS ENUM ('active','expired','cancelled','superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('cash','upi','card','bank_transfer','cheque','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_state AS ENUM ('recorded','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.period_months(_p public.billing_period)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _p WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3
                 WHEN 'half_yearly' THEN 6 WHEN 'annual' THEN 12 END
$$;

CREATE OR REPLACE FUNCTION public.gym_today(_gym_id uuid)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE COALESCE(g.timezone,'UTC'))::date FROM public.gyms g WHERE g.id = _gym_id
$$;

CREATE TABLE IF NOT EXISTS public.membership_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  features    text[] NOT NULL DEFAULT '{}',
  badge_color text,
  hides_ads   boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (gym_id, name)
);

CREATE TABLE IF NOT EXISTS public.membership_plan_prices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  period     public.billing_period NOT NULL,
  price      numeric(12,2) NOT NULL CHECK (price >= 0),
  is_enabled boolean NOT NULL DEFAULT true,
  UNIQUE (plan_id, period)
);

CREATE TABLE IF NOT EXISTS public.member_subscriptions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id    uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id   uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  plan_name_snapshot text NOT NULL,
  period    public.billing_period NOT NULL,
  started_on date NOT NULL,
  ends_on    date NOT NULL,
  state      public.subscription_state NOT NULL DEFAULT 'active',
  cancelled_at  timestamptz,
  cancel_reason text,
  superseded_by uuid REFERENCES public.member_subscriptions(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= started_on)
);
CREATE INDEX IF NOT EXISTS member_subscriptions_dues_idx ON public.member_subscriptions (gym_id, state, ends_on);
CREATE INDEX IF NOT EXISTS member_subscriptions_member_idx ON public.member_subscriptions (gym_id, member_id, state);

CREATE TABLE IF NOT EXISTS public.member_payments (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id    uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.member_subscriptions(id) ON DELETE SET NULL,
  plan_id   uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  plan_name_snapshot text NOT NULL,
  period_snapshot    public.billing_period NOT NULL,
  amount    numeric(12,2) NOT NULL,
  currency  text NOT NULL,
  paid_on   date NOT NULL,
  covers_from date NOT NULL,
  covers_to   date NOT NULL,
  method    public.payment_method NOT NULL DEFAULT 'cash',
  state     public.payment_state NOT NULL DEFAULT 'recorded',
  provider     text NOT NULL DEFAULT 'manual',
  provider_ref text,
  refund_of uuid REFERENCES public.member_payments(id),
  reference text,
  note      text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_payments_member_idx ON public.member_payments (gym_id, member_id, paid_on DESC);
CREATE INDEX IF NOT EXISTS member_payments_gym_day_idx ON public.member_payments (gym_id, paid_on);
CREATE UNIQUE INDEX IF NOT EXISTS member_payments_provider_ref_uniq
  ON public.member_payments (provider, provider_ref) WHERE provider <> 'manual';

CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id        bigserial PRIMARY KEY,
  gym_id    uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.member_subscriptions(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('message','push','manual')),
  due_on_snapshot date NOT NULL,
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX IF NOT EXISTS payment_reminders_member_idx ON public.payment_reminders (gym_id, member_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.gym_billing_settings (
  gym_id uuid PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,
  reminder_lead_days int NOT NULL DEFAULT 7 CHECK (reminder_lead_days BETWEEN 1 AND 60),
  grace_days         int NOT NULL DEFAULT 5 CHECK (grace_days BETWEEN 0 AND 30),
  auto_remind_members boolean NOT NULL DEFAULT false,
  admin_digest_enabled  boolean NOT NULL DEFAULT true,
  daily_summary_enabled boolean NOT NULL DEFAULT true,
  daily_summary_hour    int NOT NULL DEFAULT 21 CHECK (daily_summary_hour BETWEEN 0 AND 23),
  reminder_template text NOT NULL DEFAULT
    'Hi {member_name}, your {plan_name} membership at {gym_name} is due on {due_date}. Amount: {amount}. Please visit the front desk to renew.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_summary_log (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipient_count int NOT NULL DEFAULT 0,
  skipped_reason text,
  totals jsonb,
  UNIQUE (gym_id, summary_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_plan_prices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_payments TO authenticated;
GRANT SELECT, INSERT ON public.payment_reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gym_billing_settings TO authenticated;
GRANT ALL ON public.membership_plans, public.membership_plan_prices, public.member_subscriptions,
  public.member_payments, public.payment_reminders, public.gym_billing_settings,
  public.daily_summary_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payment_reminders_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.payment_reminders_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.daily_summary_log_id_seq TO service_role;

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membership plans readable in gym" ON public.membership_plans;
CREATE POLICY "Membership plans readable in gym" ON public.membership_plans
FOR SELECT TO authenticated USING (gym_id = public.current_gym_id());
DROP POLICY IF EXISTS "Membership plans admin write" ON public.membership_plans;
CREATE POLICY "Membership plans admin write" ON public.membership_plans
FOR ALL TO authenticated
USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'))
WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'));

ALTER TABLE public.membership_plan_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plan prices readable in gym" ON public.membership_plan_prices;
CREATE POLICY "Plan prices readable in gym" ON public.membership_plan_prices
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.membership_plans p
  WHERE p.id = membership_plan_prices.plan_id AND p.gym_id = public.current_gym_id()));
DROP POLICY IF EXISTS "Plan prices admin write" ON public.membership_plan_prices;
CREATE POLICY "Plan prices admin write" ON public.membership_plan_prices
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.membership_plans p
  WHERE p.id = membership_plan_prices.plan_id AND p.gym_id = public.current_gym_id()
    AND public.has_role(auth.uid(),'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.membership_plans p
  WHERE p.id = membership_plan_prices.plan_id AND p.gym_id = public.current_gym_id()
    AND public.has_role(auth.uid(),'admin')));

ALTER TABLE public.member_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subscriptions staff access" ON public.member_subscriptions;
CREATE POLICY "Subscriptions staff access" ON public.member_subscriptions
FOR ALL TO authenticated
USING (gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')))
WITH CHECK (gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')));
DROP POLICY IF EXISTS "Subscriptions member reads own" ON public.member_subscriptions;
CREATE POLICY "Subscriptions member reads own" ON public.member_subscriptions
FOR SELECT TO authenticated
USING (gym_id = public.current_gym_id() AND member_id = auth.uid());

ALTER TABLE public.member_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Payments staff access" ON public.member_payments;
CREATE POLICY "Payments staff access" ON public.member_payments
FOR ALL TO authenticated
USING (gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')))
WITH CHECK (gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')));
DROP POLICY IF EXISTS "Payments member reads own" ON public.member_payments;
CREATE POLICY "Payments member reads own" ON public.member_payments
FOR SELECT TO authenticated
USING (gym_id = public.current_gym_id() AND member_id = auth.uid());

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reminders staff access" ON public.payment_reminders;
CREATE POLICY "Reminders staff access" ON public.payment_reminders
FOR ALL TO authenticated
USING (gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')))
WITH CHECK (gym_id = public.current_gym_id()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'trainer')));

ALTER TABLE public.gym_billing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Billing settings readable in gym" ON public.gym_billing_settings;
CREATE POLICY "Billing settings readable in gym" ON public.gym_billing_settings
FOR SELECT TO authenticated USING (gym_id = public.current_gym_id());
DROP POLICY IF EXISTS "Billing settings admin write" ON public.gym_billing_settings;
CREATE POLICY "Billing settings admin write" ON public.gym_billing_settings
FOR ALL TO authenticated
USING (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'))
WITH CHECK (gym_id = public.current_gym_id() AND public.has_role(auth.uid(),'admin'));

-- audit table: RLS on, deliberately no client policy (service role + guarded RPC only)
ALTER TABLE public.daily_summary_log ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.member_profiles.membership_expires_at IS
  'Derived mirror maintained by public.sync_member_membership(). Do not write directly.';
COMMENT ON COLUMN public.member_profiles.membership_type IS
  'Derived mirror maintained by public.sync_member_membership(). Do not write directly.';

CREATE OR REPLACE FUNCTION public.sync_member_membership(_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _gym uuid; _today date; _exp date; _name text;
BEGIN
  SELECT gym_id INTO _gym FROM public.users WHERE id = _member_id;
  IF _gym IS NULL THEN RETURN; END IF;
  _today := public.gym_today(_gym);

  UPDATE public.member_subscriptions SET state = 'expired'
   WHERE member_id = _member_id AND state = 'active' AND ends_on < _today;

  SELECT ends_on, plan_name_snapshot INTO _exp, _name
    FROM public.member_subscriptions
   WHERE member_id = _member_id AND state = 'active'
   ORDER BY ends_on DESC LIMIT 1;

  IF _exp IS NULL THEN
    -- Keep the most recent LAPSED end date so membership_expires_at keeps meaning
    -- "paid through" exactly as before; a NULL here reads as "no expiry" and would
    -- silently promote lapsed members into every active-member count.
    SELECT ends_on INTO _exp FROM public.member_subscriptions
     WHERE member_id = _member_id AND state IN ('expired','cancelled','superseded')
     ORDER BY ends_on DESC LIMIT 1;
    _name := NULL;
  END IF;

  UPDATE public.member_profiles
     SET membership_expires_at = COALESCE(_exp, membership_expires_at),
         membership_type = COALESCE(_name, membership_type)
   WHERE user_id = _member_id;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.sync_member_membership(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_member_membership(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_member_membership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_member_membership(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _n int; _m record;
BEGIN
  IF NOT (public.is_platform_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  _n := 0;
  FOR _m IN
    SELECT DISTINCT s.member_id FROM public.member_subscriptions s
     WHERE s.state = 'active' AND s.ends_on < public.gym_today(s.gym_id)
  LOOP
    PERFORM public.sync_member_membership(_m.member_id);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.expire_lapsed_subscriptions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_lapsed_subscriptions() FROM anon;
GRANT EXECUTE ON FUNCTION public.expire_lapsed_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_lapsed_subscriptions() TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_payment_window(
  _member_id uuid, _plan_id uuid, _period public.billing_period, _starts_on date DEFAULT NULL)
RETURNS TABLE (covers_from date, covers_to date, previous_ends_on date,
               same_plan_sub uuid, other_plan_sub uuid, other_plan_name text,
               is_renewal boolean, is_lapsed_restart boolean, days_lapsed int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _gym uuid; _today date; _same record; _other record; _from date;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT gym_id INTO _gym FROM public.users WHERE id = _member_id;
  IF _gym IS NULL OR _gym IS DISTINCT FROM public.current_gym_id() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  _today := public.gym_today(_gym);

  SELECT s.id AS id, s.ends_on AS ends_on INTO _same
    FROM public.member_subscriptions s
   WHERE s.member_id = _member_id AND s.plan_id = _plan_id AND s.state = 'active'
   ORDER BY s.ends_on DESC LIMIT 1;

  SELECT s.id AS id, s.plan_name_snapshot AS plan_name_snapshot, s.ends_on AS ends_on INTO _other
    FROM public.member_subscriptions s
   WHERE s.member_id = _member_id AND s.plan_id <> _plan_id AND s.state = 'active'
   ORDER BY s.ends_on DESC LIMIT 1;

  IF _same.id IS NOT NULL AND _same.ends_on >= _today THEN
    _from := _same.ends_on + 1;
  ELSE
    _from := _today;
  END IF;
  IF _starts_on IS NOT NULL THEN _from := _starts_on; END IF;

  covers_from := _from;
  covers_to := (_from + (public.period_months(_period) || ' months')::interval)::date - 1;
  previous_ends_on := COALESCE(_same.ends_on, _other.ends_on,
    (SELECT mp.membership_expires_at FROM public.member_profiles mp WHERE mp.user_id = _member_id));
  same_plan_sub := _same.id;
  other_plan_sub := _other.id;
  other_plan_name := _other.plan_name_snapshot;
  is_renewal := EXISTS (SELECT 1 FROM public.member_payments p WHERE p.member_id = _member_id AND p.amount > 0);
  is_lapsed_restart := previous_ends_on IS NOT NULL AND previous_ends_on < _today;
  days_lapsed := CASE WHEN previous_ends_on IS NOT NULL AND previous_ends_on < _today
                      THEN (_today - previous_ends_on) ELSE 0 END;
  RETURN NEXT;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.resolve_payment_window(uuid, uuid, public.billing_period, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_payment_window(uuid, uuid, public.billing_period, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_payment_window(uuid, uuid, public.billing_period, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_member_payment(
  _member_id uuid, _plan_id uuid, _period public.billing_period,
  _starts_on date DEFAULT NULL, _supersede boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _w record; _price numeric(12,2); _currency text;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _w FROM public.resolve_payment_window(_member_id, _plan_id, _period, _starts_on);

  SELECT pr.price INTO _price
    FROM public.membership_plan_prices pr
    JOIN public.membership_plans p ON p.id = pr.plan_id
   WHERE pr.plan_id = _plan_id AND pr.period = _period AND pr.is_enabled
     AND p.gym_id = public.current_gym_id();

  SELECT g.currency INTO _currency FROM public.gyms g WHERE g.id = public.current_gym_id();

  RETURN jsonb_build_object(
    'price', _price, 'currency', _currency,
    'covers_from', _w.covers_from, 'covers_to', _w.covers_to,
    'previous_ends_on', _w.previous_ends_on, 'is_renewal', _w.is_renewal,
    'is_lapsed_restart', _w.is_lapsed_restart, 'days_lapsed', _w.days_lapsed,
    'supersedes_plan_name', CASE WHEN _supersede THEN _w.other_plan_name ELSE NULL END);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.preview_member_payment(uuid, uuid, public.billing_period, date, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.preview_member_payment(uuid, uuid, public.billing_period, date, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_member_payment(uuid, uuid, public.billing_period, date, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_member_payment(
  _member_id uuid, _plan_id uuid, _period public.billing_period,
  _amount numeric DEFAULT NULL, _paid_on date DEFAULT NULL,
  _method public.payment_method DEFAULT 'cash',
  _reference text DEFAULT NULL, _note text DEFAULT NULL,
  _starts_on date DEFAULT NULL, _supersede boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  _gym uuid := public.current_gym_id();
  _member_gym uuid; _today date; _w record; _price numeric(12,2);
  _plan_name text; _currency text; _sub uuid; _payment uuid;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT gym_id INTO _member_gym FROM public.users WHERE id = _member_id;
  IF _gym IS NULL OR _member_gym IS DISTINCT FROM _gym THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT p.name INTO _plan_name FROM public.membership_plans p
   WHERE p.id = _plan_id AND p.gym_id = _gym;
  IF _plan_name IS NULL THEN RAISE EXCEPTION 'Unknown membership plan'; END IF;

  _today := public.gym_today(_gym);
  _paid_on := COALESCE(_paid_on, _today);
  IF _paid_on > _today + 1 THEN RAISE EXCEPTION 'Payment date cannot be in the future'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.membership_plan_prices pr
                  WHERE pr.plan_id = _plan_id AND pr.period = _period AND pr.is_enabled) THEN
    RAISE EXCEPTION 'This plan is not sold on that term';
  END IF;
  SELECT pr.price INTO _price FROM public.membership_plan_prices pr
   WHERE pr.plan_id = _plan_id AND pr.period = _period AND pr.is_enabled;

  SELECT * INTO _w FROM public.resolve_payment_window(_member_id, _plan_id, _period, _starts_on);
  SELECT g.currency INTO _currency FROM public.gyms g WHERE g.id = _gym;

  IF _w.other_plan_sub IS NOT NULL AND _supersede THEN
    UPDATE public.member_subscriptions
       SET state = 'superseded', ends_on = GREATEST(started_on, _w.covers_from - 1)
     WHERE id = _w.other_plan_sub;
  END IF;

  IF _w.same_plan_sub IS NOT NULL THEN
    UPDATE public.member_subscriptions SET ends_on = _w.covers_to, state = 'active'
     WHERE id = _w.same_plan_sub RETURNING id INTO _sub;
  ELSE
    INSERT INTO public.member_subscriptions
      (gym_id, member_id, plan_id, plan_name_snapshot, period, started_on, ends_on, state, created_by)
    VALUES (_gym, _member_id, _plan_id, _plan_name, _period, _w.covers_from, _w.covers_to, 'active', auth.uid())
    RETURNING id INTO _sub;
  END IF;

  INSERT INTO public.member_payments
    (gym_id, member_id, subscription_id, plan_id, plan_name_snapshot, period_snapshot,
     amount, currency, paid_on, covers_from, covers_to, method, reference, note, recorded_by)
  VALUES (_gym, _member_id, _sub, _plan_id, _plan_name, _period,
          COALESCE(_amount, _price), _currency, _paid_on, _w.covers_from, _w.covers_to,
          _method, _reference, _note, auth.uid())
  RETURNING id INTO _payment;

  IF _w.other_plan_sub IS NOT NULL AND _supersede THEN
    UPDATE public.member_subscriptions SET superseded_by = _sub WHERE id = _w.other_plan_sub;
  END IF;

  PERFORM public.sync_member_membership(_member_id);

  RETURN jsonb_build_object('payment_id', _payment, 'subscription_id', _sub,
    'covers_from', _w.covers_from, 'covers_to', _w.covers_to,
    'previous_ends_on', _w.previous_ends_on);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.record_member_payment(uuid, uuid, public.billing_period, numeric, date, public.payment_method, text, text, date, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_member_payment(uuid, uuid, public.billing_period, numeric, date, public.payment_method, text, text, date, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_member_payment(uuid, uuid, public.billing_period, numeric, date, public.payment_method, text, text, date, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_member_subscription(_subscription_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _member uuid;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.member_subscriptions
     SET state = 'cancelled', cancelled_at = now(), cancel_reason = _reason
   WHERE id = _subscription_id AND gym_id = public.current_gym_id()
   RETURNING member_id INTO _member;
  IF _member IS NULL THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  PERFORM public.sync_member_membership(_member);
  RETURN jsonb_build_object('member_id', _member);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.cancel_member_subscription(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_member_subscription(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_member_subscription(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.refund_member_payment(_payment_id uuid, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _o record; _new uuid;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _o FROM public.member_payments
   WHERE id = _payment_id AND gym_id = public.current_gym_id();
  IF _o.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF _o.amount < 0 THEN RAISE EXCEPTION 'That row is already a refund'; END IF;

  INSERT INTO public.member_payments
    (gym_id, member_id, subscription_id, plan_id, plan_name_snapshot, period_snapshot,
     amount, currency, paid_on, covers_from, covers_to, method, state, refund_of, note, recorded_by)
  VALUES (_o.gym_id, _o.member_id, _o.subscription_id, _o.plan_id, _o.plan_name_snapshot,
          _o.period_snapshot, -_o.amount, _o.currency, public.gym_today(_o.gym_id),
          _o.covers_from, _o.covers_to, _o.method, 'refunded', _o.id, _note, auth.uid())
  RETURNING id INTO _new;

  RETURN jsonb_build_object('refund_id', _new, 'subscription_id', _o.subscription_id,
    'suggest_adjust_end_date', _o.subscription_id IS NOT NULL);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.refund_member_payment(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_member_payment(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.refund_member_payment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_billing_settings_ensure()
RETURNS public.gym_billing_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _gym uuid := public.current_gym_id(); _row public.gym_billing_settings;
BEGIN
  IF _gym IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.gym_billing_settings (gym_id) VALUES (_gym) ON CONFLICT (gym_id) DO NOTHING;
  SELECT * INTO _row FROM public.gym_billing_settings WHERE gym_id = _gym;
  RETURN _row;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.gym_billing_settings_ensure() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gym_billing_settings_ensure() FROM anon;
GRANT EXECUTE ON FUNCTION public.gym_billing_settings_ensure() TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_dues(_bucket text DEFAULT 'all')
RETURNS TABLE (member_id uuid, display_name text, email text, phone text,
               subscription_id uuid, plan_id uuid, plan_name text,
               period public.billing_period, amount_due numeric, currency text,
               ends_on date, days_to_due int, bucket text, in_grace boolean,
               last_payment_on date, last_reminded_at timestamptz, reminder_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _gym uuid := public.current_gym_id(); _today date; _lead int; _grace int; _currency text;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) OR _gym IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  _today := public.gym_today(_gym);
  SELECT s.reminder_lead_days, s.grace_days INTO _lead, _grace
    FROM public.gym_billing_settings s WHERE s.gym_id = _gym;
  _lead := COALESCE(_lead, 7); _grace := COALESCE(_grace, 5);
  SELECT g.currency INTO _currency FROM public.gyms g WHERE g.id = _gym;

  RETURN QUERY
  WITH subs AS (
    SELECT DISTINCT ON (s.member_id) s.*
      FROM public.member_subscriptions s
     WHERE s.gym_id = _gym AND s.state IN ('active','expired')
     ORDER BY s.member_id, s.ends_on DESC
  ), base AS (
    SELECT u.id AS m_id, u.display_name AS d_name, u.email AS m_email, u.phone AS m_phone,
           s.id AS sub_id, s.plan_id AS p_id, s.plan_name_snapshot AS p_name, s.period AS p_period,
           COALESCE(
             (SELECT pr.price FROM public.membership_plan_prices pr
               WHERE pr.plan_id = s.plan_id AND pr.period = s.period AND pr.is_enabled),
             (SELECT p.amount FROM public.member_payments p
               WHERE p.member_id = s.member_id AND p.amount > 0
               ORDER BY p.paid_on DESC LIMIT 1),
             0) AS amt,
           s.ends_on AS e_on,
           (s.ends_on - _today)::int AS dtd,
           (SELECT max(p.paid_on) FROM public.member_payments p
             WHERE p.member_id = s.member_id AND p.amount > 0) AS last_pay,
           (SELECT max(r.sent_at) FROM public.payment_reminders r
             WHERE r.member_id = s.member_id AND r.gym_id = _gym) AS last_rem,
           (SELECT count(*)::int FROM public.payment_reminders r
             WHERE r.member_id = s.member_id AND r.gym_id = _gym) AS rem_count
      FROM subs s JOIN public.users u ON u.id = s.member_id
  ), bucketed AS (
    SELECT b.*,
      CASE WHEN b.dtd < 0 THEN 'overdue' WHEN b.dtd = 0 THEN 'due_today'
           WHEN b.dtd <= _lead THEN 'due_soon' ELSE 'current' END AS bkt,
      (b.dtd < 0 AND abs(b.dtd) <= _grace) AS grace
    FROM base b
  )
  SELECT b.m_id, b.d_name, b.m_email, b.m_phone, b.sub_id, b.p_id, b.p_name, b.p_period,
         b.amt, _currency, b.e_on, b.dtd, b.bkt, b.grace, b.last_pay, b.last_rem, b.rem_count
    FROM bucketed b
   WHERE (_bucket = 'all' AND b.bkt <> 'current') OR b.bkt = _bucket
   ORDER BY b.dtd ASC, b.d_name ASC;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.gym_dues(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gym_dues(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gym_dues(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_dues_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _gym uuid := public.current_gym_id(); _today date; _res jsonb;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) OR _gym IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  _today := public.gym_today(_gym);

  WITH all_rows AS (
    SELECT * FROM public.gym_dues('overdue')
    UNION ALL SELECT * FROM public.gym_dues('due_today')
    UNION ALL SELECT * FROM public.gym_dues('due_soon')
    UNION ALL SELECT * FROM public.gym_dues('current')
  )
  SELECT jsonb_build_object(
    'overdue_count',    count(*) FILTER (WHERE bucket = 'overdue'),
    'overdue_amount',   COALESCE(sum(amount_due) FILTER (WHERE bucket = 'overdue'), 0),
    'due_today_count',  count(*) FILTER (WHERE bucket = 'due_today'),
    'due_today_amount', COALESCE(sum(amount_due) FILTER (WHERE bucket = 'due_today'), 0),
    'due_soon_count',   count(*) FILTER (WHERE bucket = 'due_soon'),
    'due_soon_amount',  COALESCE(sum(amount_due) FILTER (WHERE bucket = 'due_soon'), 0),
    'current_count',    count(*) FILTER (WHERE bucket = 'current'),
    'collected_this_month', (SELECT COALESCE(sum(p.amount), 0) FROM public.member_payments p
       WHERE p.gym_id = _gym AND p.paid_on >= date_trunc('month', _today)::date),
    'currency', (SELECT g.currency FROM public.gyms g WHERE g.id = _gym)
  ) INTO _res FROM all_rows;
  RETURN _res;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.gym_dues_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gym_dues_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.gym_dues_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.log_payment_reminder(
  _member_id uuid, _subscription_id uuid, _channel text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _gym uuid := public.current_gym_id(); _due date;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) OR _gym IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT ends_on INTO _due FROM public.member_subscriptions
   WHERE id = _subscription_id AND gym_id = _gym;
  INSERT INTO public.payment_reminders (gym_id, member_id, subscription_id, channel, due_on_snapshot, sent_by, note)
  VALUES (_gym, _member_id, _subscription_id, _channel,
          COALESCE(_due, public.gym_today(_gym)), auth.uid(), _note);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.log_payment_reminder(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_payment_reminder(uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_payment_reminder(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_daily_activity(_gym_id uuid, _day date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _tz text; _res jsonb;
BEGIN
  IF NOT (public.is_platform_admin()
          OR auth.role() = 'service_role'
          OR (public.is_gym_staff_user(auth.uid()) AND _gym_id = public.current_gym_id())) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(timezone,'UTC') INTO _tz FROM public.gyms WHERE id = _gym_id;

  WITH pay AS (
    SELECT p.*, u.display_name AS member_name,
           COALESCE(su.display_name, su.email, 'Staff') AS recorded_by_name,
           (SELECT min(pp.created_at) FROM public.member_payments pp
             WHERE pp.member_id = p.member_id AND pp.gym_id = p.gym_id AND pp.amount > 0) AS first_created_at
      FROM public.member_payments p
      JOIN public.users u ON u.id = p.member_id
      LEFT JOIN public.users su ON su.id = p.recorded_by
     WHERE p.gym_id = _gym_id AND (p.created_at AT TIME ZONE _tz)::date = _day
  ), tagged AS (
    SELECT *, (amount > 0 AND created_at = first_created_at) AS is_new FROM pay
  )
  SELECT jsonb_build_object(
    'gym_name', (SELECT name FROM public.gyms WHERE id = _gym_id),
    'gym_timezone', _tz,
    'currency', (SELECT currency FROM public.gyms WHERE id = _gym_id),
    'day', _day,
    'total_collected', COALESCE((SELECT sum(amount) FROM tagged), 0),
    'new_count',     (SELECT count(*) FROM tagged WHERE amount > 0 AND is_new),
    'renewal_count', (SELECT count(*) FROM tagged WHERE amount > 0 AND NOT is_new),
    'refund_count',  (SELECT count(*) FROM tagged WHERE amount < 0),
    'new', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'member_name', member_name, 'plan_name', plan_name_snapshot,
        'period', period_snapshot, 'amount', amount, 'covers_from', covers_from,
        'covers_to', covers_to, 'paid_on', paid_on, 'recorded_by_name', recorded_by_name))
      FROM tagged WHERE amount > 0 AND is_new), '[]'::jsonb),
    'renewals', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'member_name', member_name, 'plan_name', plan_name_snapshot,
        'period', period_snapshot, 'amount', amount, 'covers_from', covers_from,
        'covers_to', covers_to, 'paid_on', paid_on, 'recorded_by_name', recorded_by_name,
        'previous_ends_on', covers_from - 1))
      FROM tagged WHERE amount > 0 AND NOT is_new), '[]'::jsonb),
    'refunds', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'member_name', member_name, 'amount', amount, 'note', note,
        'recorded_by_name', recorded_by_name))
      FROM tagged WHERE amount < 0), '[]'::jsonb),
    'by_staff', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT recorded_by_name, count(*)::int AS payment_count, sum(amount) AS total
          FROM tagged GROUP BY recorded_by_name ORDER BY 3 DESC) x), '[]'::jsonb),
    'by_tier', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT plan_name_snapshot AS plan_name, count(*)::int AS payment_count, sum(amount) AS total
          FROM tagged GROUP BY plan_name_snapshot ORDER BY 3 DESC) x), '[]'::jsonb),
    'by_term', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT period_snapshot AS period, count(*)::int AS payment_count, sum(amount) AS total
          FROM tagged GROUP BY period_snapshot ORDER BY 3 DESC) x), '[]'::jsonb)
  ) INTO _res;
  RETURN _res;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.gym_daily_activity(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gym_daily_activity(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.gym_daily_activity(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_daily_activity(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.gym_revenue_report(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _gym uuid := public.current_gym_id(); _today date; _res jsonb;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) OR _gym IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  _today := public.gym_today(_gym);

  WITH pay AS (
    SELECT * FROM public.member_payments
     WHERE gym_id = _gym AND paid_on BETWEEN _from AND _to
  )
  SELECT jsonb_build_object(
    'currency', (SELECT currency FROM public.gyms WHERE id = _gym),
    'total_collected', COALESCE((SELECT sum(amount) FROM pay), 0),
    'monthly', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT to_char(date_trunc('month', paid_on), 'YYYY-MM') AS month, sum(amount) AS total
          FROM pay GROUP BY 1 ORDER BY 1) x), '[]'::jsonb),
    'by_tier', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT plan_name_snapshot AS plan_name, sum(amount) AS total, count(*)::int AS payment_count
          FROM pay GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
    'by_term', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT period_snapshot AS period, sum(amount) AS total, count(*)::int AS payment_count
          FROM pay GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
    'active_by_tier', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT plan_name_snapshot AS plan_name, count(*)::int AS active_count
          FROM public.member_subscriptions
         WHERE gym_id = _gym AND state = 'active' GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
    'expiring_30d', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT s.member_id, u.display_name AS member_name, s.plan_name_snapshot AS plan_name,
               s.period, s.ends_on,
               COALESCE((SELECT pr.price FROM public.membership_plan_prices pr
                          WHERE pr.plan_id = s.plan_id AND pr.period = s.period AND pr.is_enabled), 0)
                 AS expected_amount
          FROM public.member_subscriptions s JOIN public.users u ON u.id = s.member_id
         WHERE s.gym_id = _gym AND s.state = 'active'
           AND s.ends_on BETWEEN _today AND _today + 30
         ORDER BY s.ends_on) x), '[]'::jsonb),
    'expiring_30d_value', COALESCE((
        SELECT sum(COALESCE((SELECT pr.price FROM public.membership_plan_prices pr
                 WHERE pr.plan_id = s.plan_id AND pr.period = s.period AND pr.is_enabled), 0))
          FROM public.member_subscriptions s
         WHERE s.gym_id = _gym AND s.state = 'active'
           AND s.ends_on BETWEEN _today AND _today + 30), 0)
  ) INTO _res;
  RETURN _res;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.gym_revenue_report(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gym_revenue_report(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.gym_revenue_report(date, date) TO authenticated;

-- ============ C2 backfill from the legacy free-text membership_type ============
DO $mig$
DECLARE
  _g record; _t record; _m record; _plan uuid; _today date; _sub uuid;
  _state public.subscription_state; _ends date; _start date;
BEGIN
  FOR _g IN SELECT id, timezone, currency FROM public.gyms LOOP
    _today := (now() AT TIME ZONE COALESCE(_g.timezone,'UTC'))::date;

    FOR _t IN
      SELECT DISTINCT btrim(mp.membership_type) AS name
        FROM public.member_profiles mp JOIN public.users u ON u.id = mp.user_id
       WHERE u.gym_id = _g.id AND btrim(COALESCE(mp.membership_type,'')) <> ''
    LOOP
      INSERT INTO public.membership_plans (gym_id, name, description, is_active)
      VALUES (_g.id, _t.name,
        'Imported from the old membership type — set your prices to start using this tier.', false)
      ON CONFLICT (gym_id, name) DO NOTHING;

      SELECT id INTO _plan FROM public.membership_plans WHERE gym_id = _g.id AND name = _t.name;

      INSERT INTO public.membership_plan_prices (plan_id, period, price, is_enabled)
      VALUES (_plan, 'monthly', 0, false) ON CONFLICT (plan_id, period) DO NOTHING;

      FOR _m IN
        SELECT mp.user_id, mp.membership_expires_at, mp.created_at,
               mp.last_payment_date, mp.last_payment_amount
          FROM public.member_profiles mp JOIN public.users u ON u.id = mp.user_id
         WHERE u.gym_id = _g.id AND btrim(COALESCE(mp.membership_type,'')) = _t.name
      LOOP
        IF EXISTS (SELECT 1 FROM public.member_subscriptions
                    WHERE member_id = _m.user_id AND plan_id = _plan) THEN CONTINUE; END IF;

        _ends := COALESCE(_m.membership_expires_at, _today);
        _start := LEAST(COALESCE(_m.created_at::date, _today), _ends);
        _state := CASE WHEN _ends < _today THEN 'expired' ELSE 'active' END;

        INSERT INTO public.member_subscriptions
          (gym_id, member_id, plan_id, plan_name_snapshot, period, started_on, ends_on, state)
        VALUES (_g.id, _m.user_id, _plan, _t.name, 'monthly', _start, _ends, _state)
        RETURNING id INTO _sub;

        IF _m.last_payment_date IS NOT NULL THEN
          INSERT INTO public.member_payments
            (gym_id, member_id, subscription_id, plan_id, plan_name_snapshot, period_snapshot,
             amount, currency, paid_on, covers_from, covers_to, method, provider, note)
          VALUES (_g.id, _m.user_id, _sub, _plan, _t.name, 'monthly',
                  COALESCE(_m.last_payment_amount, 0), _g.currency, _m.last_payment_date,
                  _start, _ends, 'other', 'manual',
                  'Imported from the previous single-payment fields.');
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $mig$;
