CREATE OR REPLACE FUNCTION public.attendance_buckets(_gym_id uuid, _start date, _end date)
 RETURNS TABLE(day date, hour integer, member_id uuid, cnt bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    (_gym_id = public.current_gym_id()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer')))
    OR public.is_platform_admin()
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ((a.check_in_at AT TIME ZONE g.timezone))::date AS day,
    EXTRACT(hour FROM (a.check_in_at AT TIME ZONE g.timezone))::int AS hour,
    a.member_id,
    count(*) AS cnt
  FROM public.attendance_logs a
  JOIN public.gyms g ON g.id = a.gym_id
  WHERE a.gym_id = _gym_id
    -- Trainers see only their assigned members; admins and platform admins see everyone.
    AND (public.has_role(auth.uid(), 'admin') OR public.is_platform_admin() OR public.is_trainer_of(a.member_id))
    AND ((a.check_in_at AT TIME ZONE g.timezone))::date BETWEEN _start AND _end
  GROUP BY 1, 2, 3;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gym_dues(_bucket text DEFAULT 'all'::text)
 RETURNS TABLE(member_id uuid, display_name text, email text, phone text, subscription_id uuid, plan_id uuid, plan_name text, period billing_period, amount_due numeric, currency text, ends_on date, days_to_due integer, bucket text, in_grace boolean, last_payment_on date, last_reminded_at timestamp with time zone, reminder_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _gym uuid; _today date; _lead int; _grace int; _currency text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  _gym := public.current_gym_id();
  IF _gym IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  _today := public.gym_today(_gym);
  SELECT s.reminder_lead_days, s.grace_days INTO _lead, _grace
    FROM public.gym_billing_settings s WHERE s.gym_id = _gym;
  _lead := COALESCE(_lead, 7); _grace := COALESCE(_grace, 5);
  SELECT g.currency INTO _currency FROM public.gyms g WHERE g.id = _gym;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (s.member_id) s.*
      FROM public.member_subscriptions s
     WHERE s.gym_id = _gym AND s.state IN ('active','expired','cancelled')
     ORDER BY s.member_id, s.ends_on DESC, s.created_at DESC
  ), subs AS (SELECT * FROM latest l WHERE l.state <> 'cancelled'),
  base AS (
    SELECT u.id AS m_id, u.display_name AS d_name, u.email AS m_email, u.phone AS m_phone,
           s.id AS sub_id, s.plan_id AS p_id, s.plan_name_snapshot AS p_name, s.period AS p_period,
           COALESCE(
             (SELECT pr.price FROM public.membership_plan_prices pr
               WHERE pr.plan_id = s.plan_id AND pr.period = s.period AND pr.is_enabled),
             (SELECT p.amount FROM public.member_payments p
               WHERE p.member_id = s.member_id AND p.amount > 0 ORDER BY p.paid_on DESC LIMIT 1),
             0) AS amt,
           s.ends_on AS e_on, (s.ends_on - _today)::int AS dtd,
           (SELECT max(p.paid_on) FROM public.member_payments p
             WHERE p.member_id = s.member_id AND p.amount > 0) AS last_pay,
           (SELECT max(r.sent_at) FROM public.payment_reminders r
             WHERE r.member_id = s.member_id AND r.gym_id = _gym) AS last_rem,
           (SELECT count(*)::int FROM public.payment_reminders r
             WHERE r.member_id = s.member_id AND r.gym_id = _gym) AS rem_count
      FROM subs s JOIN public.users u ON u.id = s.member_id AND u.active
     WHERE public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(u.id)
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
END; $function$;

CREATE OR REPLACE FUNCTION public.gym_dues_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _gym uuid; _today date; _res jsonb; _start date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  _gym := public.current_gym_id();
  IF _gym IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  _today := public.gym_today(_gym);
  _start := date_trunc('month', _today)::date;
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
       WHERE p.gym_id = _gym AND p.paid_on >= _start AND p.amount > 0 AND p.kind = 'payment'
         AND (public.has_role(auth.uid(), 'admin') OR p.recorded_by = auth.uid())),
    'refunded_this_month', (SELECT COALESCE(sum(-p.amount), 0) FROM public.member_payments p
       WHERE p.gym_id = _gym AND p.paid_on >= _start AND p.amount < 0 AND p.refund_of IS NOT NULL
         AND public.has_role(auth.uid(), 'admin')),
    'money_scope', CASE WHEN public.has_role(auth.uid(), 'admin') THEN 'gym' ELSE 'mine' END,
    'currency', (SELECT g.currency FROM public.gyms g WHERE g.id = _gym)
  ) INTO _res FROM all_rows;
  RETURN _res;
END; $function$;

CREATE OR REPLACE FUNCTION public.log_payment_reminder(_member_id uuid, _subscription_id uuid, _channel text, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _gym uuid; _due date; _tz text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_gym_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  _gym := public.current_gym_id();
  IF _gym IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _member_id AND u.gym_id = _gym) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.is_trainer_of(_member_id)) THEN
    RAISE EXCEPTION 'Only for your assigned members' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(timezone,'UTC') INTO _tz FROM public.gyms WHERE id = _gym;
  PERFORM pg_advisory_xact_lock(hashtext('remind:' || _member_id::text));
  IF EXISTS (SELECT 1 FROM public.payment_reminders r
              WHERE r.gym_id = _gym AND r.member_id = _member_id
                AND (r.sent_at AT TIME ZONE _tz)::date = public.gym_today(_gym)) THEN
    RAISE EXCEPTION 'Already reminded today' USING ERRCODE = 'P0001';
  END IF;
  SELECT ends_on INTO _due FROM public.member_subscriptions
   WHERE id = _subscription_id AND gym_id = _gym;
  INSERT INTO public.payment_reminders (gym_id, member_id, subscription_id, channel, due_on_snapshot, sent_by, note)
  VALUES (_gym, _member_id, _subscription_id, _channel,
          COALESCE(_due, public.gym_today(_gym)), auth.uid(), _note);
END; $function$;

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
     amount, currency, paid_on, covers_from, covers_to, method, reference, note, recorded_by)
  VALUES (_gym, _member_id, _sub, _plan_id, _plan_name, _period,
          COALESCE(_amount, _price), _currency, _paid_on, _w.covers_from, _w.covers_to,
          _method, _reference, _note, auth.uid())
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

CREATE OR REPLACE FUNCTION public.cancel_member_subscription(_subscription_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _member uuid;
BEGIN
  -- Admins only: trainers may record payments and remind, never cancel.
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
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
$function$;