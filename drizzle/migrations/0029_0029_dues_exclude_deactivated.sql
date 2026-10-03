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
  IF _gym IS NULL THEN
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
      FROM subs s JOIN public.users u ON u.id = s.member_id AND u.active
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
$function$;

REVOKE EXECUTE ON FUNCTION public.gym_dues(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gym_dues(text) TO authenticated;