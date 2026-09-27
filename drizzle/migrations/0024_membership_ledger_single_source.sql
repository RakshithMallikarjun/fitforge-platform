ALTER TABLE public.member_subscriptions ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE public.member_subscriptions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'payment'
  CHECK (source IN ('payment','imported'));
ALTER TABLE public.member_payments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'payment'
  CHECK (kind IN ('payment','adjustment'));

CREATE OR REPLACE FUNCTION public.sync_member_membership(_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _gym uuid; _today date; _exp date; _name text;
BEGIN
  SELECT gym_id INTO _gym FROM public.users WHERE id = _member_id;
  IF _gym IS NULL THEN RETURN; END IF;
  _today := public.gym_today(_gym);
  UPDATE public.member_subscriptions SET state = 'expired'
   WHERE member_id = _member_id AND state = 'active' AND ends_on < _today;
  SELECT ends_on, plan_name_snapshot INTO _exp, _name
    FROM public.member_subscriptions
   WHERE member_id = _member_id AND state IN ('active','expired')
   ORDER BY ends_on DESC LIMIT 1;
  UPDATE public.member_profiles
     SET membership_expires_at = _exp, membership_type = _name
   WHERE user_id = _member_id;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_payment_window(_member_id uuid, _plan_id uuid, _period billing_period, _starts_on date DEFAULT NULL::date)
 RETURNS TABLE(covers_from date, covers_to date, previous_ends_on date, same_plan_sub uuid, other_plan_sub uuid, other_plan_name text, is_renewal boolean, is_lapsed_restart boolean, days_lapsed integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
   WHERE s.member_id = _member_id AND s.plan_id IS DISTINCT FROM _plan_id AND s.state = 'active'
   ORDER BY s.ends_on DESC LIMIT 1;
  IF _same.id IS NOT NULL AND _same.ends_on >= _today THEN _from := _same.ends_on + 1;
  ELSE _from := _today; END IF;
  IF _starts_on IS NOT NULL THEN _from := _starts_on; END IF;
  covers_from := _from;
  covers_to := (_from + (public.period_months(_period) || ' months')::interval)::date - 1;
  previous_ends_on := COALESCE(_same.ends_on, _other.ends_on,
    (SELECT max(s.ends_on) FROM public.member_subscriptions s
      WHERE s.member_id = _member_id AND s.state IN ('active','expired')));
  same_plan_sub := _same.id;
  other_plan_sub := _other.id;
  other_plan_name := _other.plan_name_snapshot;
  is_renewal := EXISTS (SELECT 1 FROM public.member_payments p WHERE p.member_id = _member_id AND p.amount > 0);
  is_lapsed_restart := previous_ends_on IS NOT NULL AND previous_ends_on < _today;
  days_lapsed := CASE WHEN previous_ends_on IS NOT NULL AND previous_ends_on < _today
                      THEN (_today - previous_ends_on) ELSE 0 END;
  RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.record_member_payment(_member_id uuid, _plan_id uuid, _period billing_period, _amount numeric DEFAULT NULL::numeric, _paid_on date DEFAULT NULL::date, _method payment_method DEFAULT 'cash'::payment_method, _reference text DEFAULT NULL::text, _note text DEFAULT NULL::text, _starts_on date DEFAULT NULL::date, _supersede boolean DEFAULT true)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  SELECT p.name INTO _plan_name FROM public.membership_plans p WHERE p.id = _plan_id AND p.gym_id = _gym;
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
  UPDATE public.member_subscriptions SET state = 'superseded', superseded_by = _sub
   WHERE member_id = _member_id AND source = 'imported' AND state IN ('active','expired');
  PERFORM public.sync_member_membership(_member_id);
  RETURN jsonb_build_object('payment_id', _payment, 'subscription_id', _sub,
    'covers_from', _w.covers_from, 'covers_to', _w.covers_to,
    'previous_ends_on', _w.previous_ends_on);
END; $$;

CREATE OR REPLACE FUNCTION public.refund_member_payment(_payment_id uuid, _note text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record; _new uuid;
BEGIN
  IF NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _o FROM public.member_payments WHERE id = _payment_id AND gym_id = public.current_gym_id();
  IF _o.id IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF _o.kind = 'adjustment' THEN RAISE EXCEPTION 'An expiry adjustment cannot be refunded'; END IF;
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
END; $$;

CREATE OR REPLACE FUNCTION public.adjust_member_expiry(_member_id uuid, _ends_on date, _reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _gym uuid := public.current_gym_id(); _today date; _s record; _payment uuid; _currency text;
BEGIN
  IF auth.uid() IS NULL OR _gym IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.gym_id = _gym AND r.role = 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _member_id AND u.gym_id = _gym) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF _ends_on IS NULL THEN RAISE EXCEPTION 'Pick a new expiry date'; END IF;
  IF length(btrim(coalesce(_reason, ''))) < 3 THEN RAISE EXCEPTION 'Give a reason for the adjustment'; END IF;
  SELECT * INTO _s FROM public.member_subscriptions
   WHERE member_id = _member_id AND gym_id = _gym AND state IN ('active','expired')
   ORDER BY ends_on DESC LIMIT 1;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'This member has no membership yet. Record a payment first.'; END IF;
  IF _ends_on < _s.started_on THEN RAISE EXCEPTION 'The new expiry cannot be before the membership started'; END IF;
  _today := public.gym_today(_gym);
  SELECT g.currency INTO _currency FROM public.gyms g WHERE g.id = _gym;
  UPDATE public.member_subscriptions
     SET ends_on = _ends_on,
         state = (CASE WHEN _ends_on >= _today THEN 'active' ELSE 'expired' END)::subscription_state
   WHERE id = _s.id;
  INSERT INTO public.member_payments
    (gym_id, member_id, subscription_id, plan_id, plan_name_snapshot, period_snapshot,
     amount, currency, paid_on, covers_from, covers_to, method, kind, note, recorded_by)
  VALUES (_gym, _member_id, _s.id, _s.plan_id, _s.plan_name_snapshot, _s.period,
          0, _currency, _today, _s.ends_on, _ends_on, 'other', 'adjustment', btrim(_reason), auth.uid())
  RETURNING id INTO _payment;
  PERFORM public.sync_member_membership(_member_id);
  RETURN jsonb_build_object('payment_id', _payment, 'previous_ends_on', _s.ends_on, 'ends_on', _ends_on);
END; $$;
REVOKE EXECUTE ON FUNCTION public.adjust_member_expiry(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_member_expiry(uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_daily_activity(_gym_id uuid, _day date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  ), money AS (SELECT * FROM tagged WHERE kind = 'payment')
  SELECT jsonb_build_object(
    'gym_name', (SELECT name FROM public.gyms WHERE id = _gym_id),
    'gym_timezone', _tz,
    'currency', (SELECT currency FROM public.gyms WHERE id = _gym_id),
    'day', _day,
    'total_collected', COALESCE((SELECT sum(amount) FROM money), 0),
    'new_count',     (SELECT count(*) FROM money WHERE amount > 0 AND is_new),
    'renewal_count', (SELECT count(*) FROM money WHERE amount > 0 AND NOT is_new),
    'refund_count',  (SELECT count(*) FROM money WHERE amount < 0),
    'adjustment_count', (SELECT count(*) FROM tagged WHERE kind = 'adjustment'),
    'new', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'member_name', member_name, 'plan_name', plan_name_snapshot,
        'period', period_snapshot, 'amount', amount, 'covers_from', covers_from,
        'covers_to', covers_to, 'paid_on', paid_on, 'recorded_by_name', recorded_by_name))
      FROM money WHERE amount > 0 AND is_new), '[]'::jsonb),
    'renewals', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'member_name', member_name, 'plan_name', plan_name_snapshot,
        'period', period_snapshot, 'amount', amount, 'covers_from', covers_from,
        'covers_to', covers_to, 'paid_on', paid_on, 'recorded_by_name', recorded_by_name,
        'previous_ends_on', covers_from - 1))
      FROM money WHERE amount > 0 AND NOT is_new), '[]'::jsonb),
    'refunds', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'member_name', member_name, 'amount', amount, 'note', note,
        'recorded_by_name', recorded_by_name))
      FROM money WHERE amount < 0), '[]'::jsonb),
    'adjustments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'member_name', member_name, 'plan_name', plan_name_snapshot,
        'previous_ends_on', covers_from, 'ends_on', covers_to, 'note', note,
        'recorded_by_name', recorded_by_name))
      FROM tagged WHERE kind = 'adjustment'), '[]'::jsonb),
    'by_staff', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT recorded_by_name, count(*)::int AS payment_count, sum(amount) AS total
          FROM money GROUP BY recorded_by_name ORDER BY 3 DESC) x), '[]'::jsonb),
    'by_tier', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT plan_name_snapshot AS plan_name, count(*)::int AS payment_count, sum(amount) AS total
          FROM money GROUP BY plan_name_snapshot ORDER BY 3 DESC) x), '[]'::jsonb),
    'by_term', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT period_snapshot AS period, count(*)::int AS payment_count, sum(amount) AS total
          FROM money GROUP BY period_snapshot ORDER BY 3 DESC) x), '[]'::jsonb)
  ) INTO _res;
  RETURN _res;
END; $$;

INSERT INTO public.member_subscriptions
  (gym_id, member_id, plan_id, plan_name_snapshot, period, started_on, ends_on, state, source)
SELECT u.gym_id, mp.user_id, NULL, 'Legacy', 'monthly',
       LEAST(mp.membership_expires_at, u.created_at::date), mp.membership_expires_at,
       (CASE WHEN mp.membership_expires_at >= public.gym_today(u.gym_id) THEN 'active' ELSE 'expired' END)::subscription_state,
       'imported'
  FROM public.member_profiles mp
  JOIN public.users u ON u.id = mp.user_id
 WHERE u.gym_id IS NOT NULL
   AND mp.membership_expires_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.member_subscriptions s WHERE s.member_id = mp.user_id);

DO $$ DECLARE _m record; BEGIN
  FOR _m IN SELECT user_id FROM public.member_profiles LOOP
    PERFORM public.sync_member_membership(_m.user_id);
  END LOOP;
END $$;