/**
 * Daily dues digest for staff (09:00 in each gym's own timezone) plus the
 * nightly lapsed-subscription sweep. Service-role client, so a scheduler needs
 * no session. Pushes go through notifyUserPush (VAPID lives on the edge).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUserPush } from "@/lib/dues-push.server";

function dateInZone(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function hourInZone(tz: string) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(
        new Date(),
      ),
    );
  } catch {
    return new Date().getUTCHours();
  }
}

export type DigestResult = {
  gym_id: string;
  gym_name: string;
  outcome: "pushed" | "skipped";
  reason?: string;
  overdue?: number;
  due_today?: number;
  pushed?: number;
  reminded?: number;
};

export async function runDuesDigest(opts: { force?: boolean; hour?: number }) {
  const targetHour = opts.hour ?? 9;
  const results: DigestResult[] = [];

  // Nightly housekeeping: flip lapsed subscriptions across all gyms.
  const { error: expErr } = await supabaseAdmin.rpc("expire_lapsed_subscriptions");
  if (expErr) console.error("[dues-digest] expire_lapsed_subscriptions", expErr.message);

  const { data: gyms, error } = await supabaseAdmin
    .from("gyms")
    .select("id, name, timezone, currency, is_enabled");
  if (error) throw new Error(error.message);

  for (const gym of (gyms ?? []) as any[]) {
    const tz = gym.timezone ?? "UTC";
    const push = (o: Omit<DigestResult, "gym_id" | "gym_name">) =>
      results.push({ gym_id: gym.id, gym_name: gym.name, ...o });

    if (!gym.is_enabled) {
      push({ outcome: "skipped", reason: "gym_disabled" });
      continue;
    }
    if (!opts.force && hourInZone(tz) !== targetHour) {
      push({ outcome: "skipped", reason: "not_this_hour" });
      continue;
    }

    const { data: settings } = await supabaseAdmin
      .from("gym_billing_settings")
      .select("admin_digest_enabled, auto_remind_members, reminder_template")
      .eq("gym_id", gym.id)
      .maybeSingle();
    if (((settings as any)?.admin_digest_enabled ?? true) === false) {
      push({ outcome: "skipped", reason: "digest_disabled" });
      continue;
    }

    const today = dateInZone(tz);
    const { data: subs } = await supabaseAdmin
      .from("member_subscriptions")
      .select("id, member_id, plan_id, plan_name_snapshot, period, ends_on, state")
      .eq("gym_id", gym.id)
      .in("state", ["active", "expired"]);

    const latest = new Map<string, any>();
    for (const s of (subs ?? []) as any[]) {
      const prev = latest.get(s.member_id);
      if (!prev || s.ends_on > prev.ends_on) latest.set(s.member_id, s);
    }
    const rows = [...latest.values()].map((s) => ({
      ...s,
      days: Math.round(
        (Date.parse(`${s.ends_on}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5,
      ),
    }));
    const overdue = rows.filter((r) => r.days < 0);
    const dueToday = rows.filter((r) => r.days === 0);

    // Nothing outstanding: send nothing at all.
    if (!overdue.length && !dueToday.length) {
      push({ outcome: "skipped", reason: "nothing_outstanding" });
      continue;
    }

    const planIds = [...new Set(rows.map((r) => r.plan_id))];
    const { data: prices } = planIds.length
      ? await supabaseAdmin
          .from("membership_plan_prices")
          .select("plan_id, period, price, is_enabled")
          .in("plan_id", planIds)
      : { data: [] as any[] };
    const priceOf = (planId: string, period: string) =>
      Number(
        ((prices ?? []) as any[]).find(
          (p) => p.plan_id === planId && p.period === period && p.is_enabled,
        )?.price ?? 0,
      );
    const outstanding = [...overdue, ...dueToday].reduce(
      (sum, r) => sum + priceOf(r.plan_id, r.period),
      0,
    );

    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("gym_id", gym.id)
      .in("role", ["admin", "trainer"]);
    const staffIds = [...new Set(((staffRoles ?? []) as any[]).map((r) => r.user_id))];
    const { data: staff } = staffIds.length
      ? await supabaseAdmin
          .from("users")
          .select("id, push_subscription, active")
          .in("id", staffIds)
          .eq("active", true)
      : { data: [] as any[] };

    let pushed = 0;
    for (const s of (staff ?? []) as any[]) {
      if (!s.push_subscription) continue;
      await notifyUserPush(
        s.id,
        `${gym.name}: ${overdue.length + dueToday.length} payments to collect`,
        `${overdue.length} overdue, ${dueToday.length} due today — ${gym.currency} ${outstanding} outstanding`,
        "/admin/dues",
      );
      pushed++;
    }

    let reminded = 0;
    if ((settings as any)?.auto_remind_members) {
      const template =
        (settings as any)?.reminder_template ??
        "Hi {member_name}, your {plan_name} membership at {gym_name} is due on {due_date}. Amount: {amount}.";
      const targets = [...overdue, ...dueToday];
      const memberIds = targets.map((r) => r.member_id);
      const { data: recent } = memberIds.length
        ? await supabaseAdmin
            .from("payment_reminders")
            .select("member_id")
            .eq("gym_id", gym.id)
            .in("member_id", memberIds)
            .gte("sent_at", new Date(Date.now() - 864e5).toISOString())
        : { data: [] as any[] };
      const throttled = new Set(((recent ?? []) as any[]).map((r) => r.member_id));
      const { data: members } = memberIds.length
        ? await supabaseAdmin.from("users").select("id, display_name").in("id", memberIds)
        : { data: [] as any[] };
      const nameOf = new Map(((members ?? []) as any[]).map((m) => [m.id, m.display_name]));
      const senderId = ((staffRoles ?? []) as any[]).find((x) => x.role === "admin")?.user_id;

      for (const r of targets) {
        if (throttled.has(r.member_id) || !senderId) continue;
        const body = template
          .replaceAll("{member_name}", nameOf.get(r.member_id) ?? "there")
          .replaceAll("{gym_name}", gym.name)
          .replaceAll("{plan_name}", r.plan_name_snapshot)
          .replaceAll("{due_date}", r.ends_on)
          .replaceAll("{amount}", `${gym.currency} ${priceOf(r.plan_id, r.period)}`);

        await supabaseAdmin
          .from("messages")
          .insert({ gym_id: gym.id, sender_id: senderId, recipient_id: r.member_id, body });
        await supabaseAdmin.from("payment_reminders").insert({
          gym_id: gym.id,
          member_id: r.member_id,
          subscription_id: r.id,
          channel: "message",
          due_on_snapshot: r.ends_on,
          note: "Automatic dues reminder",
        });
        await notifyUserPush(r.member_id, gym.name, body, "/app/profile");
        reminded++;
      }
    }

    push({
      outcome: "pushed",
      overdue: overdue.length,
      due_today: dueToday.length,
      pushed,
      reminded,
    });
  }

  return results;
}
