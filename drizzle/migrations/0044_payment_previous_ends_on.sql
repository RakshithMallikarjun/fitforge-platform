ALTER TABLE public.member_payments ADD COLUMN IF NOT EXISTS previous_ends_on date;
COMMENT ON COLUMN public.member_payments.previous_ends_on IS 'Membership end date shown to staff when this payment was recorded';

CREATE OR REPLACE FUNCTION public.record_member_payment(_member_id uuid, _plan_id uuid, _period billing_period, _amount numeric DEFAULT NULL::numeric, _paid_on date DEFAULT NULL::date, _method payment_method DEFAULT 'cash'::payment_method, _reference text DEFAULT NULL::text, _note text DEFAULT NULL::text, _starts_on date DEFAULT NULL::date, _supersede boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _gym uuid; _member_gym uuid; _today date; _w record; _price numeric(12,2);
  _plan_name text; _currency text; _sub uuid; _payment uuid; _last_end date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(_member_id)) THEN
    RAISE EXCEPTION 'Only for your assigned members' USING ERRCODE = '42501';
  END IF;
  _gym := public.current_gym_id();
  SELECT gym_id INTO _member_gym FROM public.users WHERE id = _member_id;
  IF _gym IS NULL OR _member_gym IS DISTINCT FROM _gym THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT p.name INTO _plan_name FROM public.membership_plans p WHERE p.id = _plan_id AND p.gym_id = _gym;
  IF _plan_name IS NULL THEN RAISE EXCEPTION 'Unknown membership plan'; END IF;
  _today := public.gym_today(_gym);
  _paid_on := COALESCE(_paid_on, _today);
  IF _paid_on > _today + 1 THEN RAISE EXCEPTION 'Payment date cannot be in the future'; END IF;
  SELECT pr.price INTO _price FROM public.membership_plan_prices pr
   WHERE pr.plan_id = _plan_id AND pr.period = _period AND pr.is_enabled;
  IF _price IS NULL THEN RAISE EXCEPTION 'This plan is not sold on that term'; END IF;
  IF _starts_on IS NULL THEN
    SELECT max(s.ends_on) INTO _last_end FROM public.member_subscriptions s
     WHERE s.member_id = _member_id AND s.state IN ('active','expired','cancelled');
    _starts_on := GREATEST(_paid_on, COALESCE(_last_end + 1, _paid_on));
  END IF;
  SELECT * INTO _w FROM public.resolve_payment_window(_member_id, _plan_id, _period, _starts_on);
  SELECT g.currency INTO _currency FROM public.gyms g WHERE g.id = _gym;
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
     amount, currency, paid_on, covers_from, covers_to, method, reference, note, recorded_by, previous_ends_on)
  VALUES (_gym, _member_id, _sub, _plan_id, _plan_name, _period,
          COALESCE(_amount, _price), _currency, _paid_on, _w.covers_from, _w.covers_to,
          _method, _reference, _note, auth.uid(), _w.previous_ends_on)
  RETURNING id INTO _payment;
  -- a member has ONE current membership: every earlier one is replaced
  UPDATE public.member_subscriptions
     SET state = 'superseded', superseded_by = _sub,
         ends_on = LEAST(ends_on, GREATEST(started_on, _w.covers_from - 1))
   WHERE member_id = _member_id AND id <> _sub AND state IN ('active','expired','cancelled');
  PERFORM public.sync_member_membership(_member_id);
  RETURN jsonb_build_object('payment_id', _payment, 'subscription_id', _sub,
    'covers_from', _w.covers_from, 'covers_to', _w.covers_to,
    'previous_ends_on', _w.previous_ends_on);
END; $function$;

CREATE OR REPLACE FUNCTION public.gym_daily_activity(_gym_id uuid, _day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'previous_ends_on', COALESCE(previous_ends_on, covers_from - 1)))
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
END; $function$;