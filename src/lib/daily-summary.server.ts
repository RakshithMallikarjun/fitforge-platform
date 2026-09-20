/**
 * End-of-day membership summary email.
 *
 * Runs with the service-role client so a cron caller needs no session. Email
 * goes out through the Resend REST API (no npm package, worker-safe).
 *
 * Privacy: the payload carries member NAMES, tiers, terms and amounts only.
 * Never add phone numbers, email addresses, health notes, measurements,
 * assessments or photos — this mail leaves the platform unencrypted and is
 * retained by arbitrary mail hosts.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Activity = {
  gym_name: string;
  gym_timezone: string;
  currency: string;
  day: string;
  total_collected: number;
  new_count: number;
  renewal_count: number;
  refund_count: number;
  new: any[];
  renewals: any[];
  refunds: any[];
  by_staff: any[];
  by_tier: any[];
  by_term: any[];
};

const PERIOD_LABEL: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annual: "Annual",
};

function dateInZone(tz: string, at: Date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

function hourInZone(tz: string, at: Date = new Date()) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(at),
    );
  } catch {
    return at.getUTCHours();
  }
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function prettyDate(day: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${day}T12:00:00Z`));
  } catch {
    return day;
  }
}

function esc(v: unknown) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function rowsTable(title: string, headers: string[], rows: string[][], note?: string): string {
  if (!rows.length) return "";
  return `
  <tr><td style="padding:20px 24px 6px;font:600 14px Arial,sans-serif;color:#111">${esc(title)}</td></tr>
  ${note ? `<tr><td style="padding:0 24px 8px;font:400 12px Arial,sans-serif;color:#666">${esc(note)}</td></tr>` : ""}
  <tr><td style="padding:0 24px 8px">
    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:400 13px Arial,sans-serif">
      <tr style="background:#f3f4f6">${headers.map((h) => `<th align="left" style="border-bottom:1px solid #e5e7eb;font:600 12px Arial,sans-serif;color:#374151">${esc(h)}</th>`).join("")}</tr>
      ${rows
        .map(
          (r) =>
            `<tr>${r.map((c) => `<td style="border-bottom:1px solid #f1f5f9;color:#111">${c}</td>`).join("")}</tr>`,
        )
        .join("")}
    </table>
  </td></tr>`;
}

export function renderSummaryEmail(a: Activity, duesUrl: string) {
  const tz = a.gym_timezone;
  const backdated = (p: any) =>
    p.paid_on && p.paid_on !== a.day
      ? ` <span style="color:#b45309">(back-dated to ${esc(p.paid_on)})</span>`
      : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0">
 <tr><td align="center">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:96%;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
   <tr><td style="padding:24px 24px 4px;font:700 18px Arial,sans-serif;color:#111">${esc(a.gym_name)}</td></tr>
   <tr><td style="padding:0 24px 16px;font:400 13px Arial,sans-serif;color:#666">Membership summary — ${esc(prettyDate(a.day, tz))} (${esc(tz)})</td></tr>
   <tr><td style="padding:0 24px 8px">
     <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font:400 13px Arial,sans-serif">
      <tr>
       <td style="background:#f3f4f6;border-radius:8px"><div style="color:#666;font-size:12px">Total collected</div><div style="font:700 18px Arial,sans-serif;color:#111">${esc(money(a.total_collected, a.currency))}</div></td>
       <td style="background:#f3f4f6;border-radius:8px"><div style="color:#666;font-size:12px">New memberships</div><div style="font:700 18px Arial,sans-serif;color:#111">${a.new_count}</div></td>
       <td style="background:#f3f4f6;border-radius:8px"><div style="color:#666;font-size:12px">Renewals</div><div style="font:700 18px Arial,sans-serif;color:#111">${a.renewal_count}</div></td>
      </tr>
     </table>
   </td></tr>
   ${rowsTable(
     "New memberships",
     ["Member", "Tier", "Term", "Amount", "Covers until", "Recorded by"],
     (a.new ?? []).map((p) => [
       esc(p.member_name) + backdated(p),
       esc(p.plan_name),
       esc(PERIOD_LABEL[p.period] ?? p.period),
       esc(money(Number(p.amount), a.currency)),
       esc(p.covers_to),
       esc(p.recorded_by_name),
     ]),
   )}
   ${rowsTable(
     "Renewals",
     ["Member", "Tier", "Term", "Amount", "Previous expiry", "Covers until", "Recorded by"],
     (a.renewals ?? []).map((p) => [
       esc(p.member_name) + backdated(p),
       esc(p.plan_name),
       esc(PERIOD_LABEL[p.period] ?? p.period),
       esc(money(Number(p.amount), a.currency)),
       esc(p.previous_ends_on),
       esc(p.covers_to),
       esc(p.recorded_by_name),
     ]),
   )}
   ${rowsTable(
     "Refunds",
     ["Member", "Amount", "Note", "Recorded by"],
     (a.refunds ?? []).map((p) => [
       esc(p.member_name),
       `<span style="color:#b91c1c">${esc(money(Number(p.amount), a.currency))}</span>`,
       esc(p.note ?? "—"),
       esc(p.recorded_by_name),
     ]),
   )}
   ${rowsTable(
     "Collected by",
     ["Staff member", "Payments", "Total"],
     (a.by_staff ?? []).map((s) => [
       esc(s.recorded_by_name),
       String(s.payment_count),
       esc(money(Number(s.total), a.currency)),
     ]),
     "Check these totals against the cash drawer.",
   )}
   ${rowsTable(
     "By tier",
     ["Tier", "Payments", "Total"],
     (a.by_tier ?? []).map((s) => [
       esc(s.plan_name),
       String(s.payment_count),
       esc(money(Number(s.total), a.currency)),
     ]),
   )}
   ${rowsTable(
     "By term",
     ["Term", "Payments", "Total"],
     (a.by_term ?? []).map((s) => [
       esc(PERIOD_LABEL[s.period] ?? s.period),
       String(s.payment_count),
       esc(money(Number(s.total), a.currency)),
     ]),
   )}
   <tr><td style="padding:16px 24px 24px;font:400 12px Arial,sans-serif;color:#666;border-top:1px solid #f1f5f9">
     Manually recorded by your staff — FitForge does not process payments.
     <br /><a href="${esc(duesUrl)}" style="color:#2563eb">Open payments due</a>
   </td></tr>
  </table>
 </td></tr>
</table></body></html>`;

  const text = [
    `${a.gym_name} — membership summary ${prettyDate(a.day, tz)} (${tz})`,
    `Total collected: ${money(a.total_collected, a.currency)}`,
    `New: ${a.new_count} | Renewals: ${a.renewal_count} | Refunds: ${a.refund_count}`,
    "",
    ...(a.new ?? []).map(
      (p: any) =>
        `NEW  ${p.member_name} — ${p.plan_name} ${PERIOD_LABEL[p.period] ?? p.period} ${money(Number(p.amount), a.currency)} until ${p.covers_to} (by ${p.recorded_by_name})${p.paid_on !== a.day ? ` [back-dated to ${p.paid_on}]` : ""}`,
    ),
    ...(a.renewals ?? []).map(
      (p: any) =>
        `RNW  ${p.member_name} — ${p.plan_name} ${PERIOD_LABEL[p.period] ?? p.period} ${money(Number(p.amount), a.currency)} ${p.previous_ends_on} -> ${p.covers_to} (by ${p.recorded_by_name})${p.paid_on !== a.day ? ` [back-dated to ${p.paid_on}]` : ""}`,
    ),
    ...(a.refunds ?? []).map(
      (p: any) => `REF  ${p.member_name} — ${money(Number(p.amount), a.currency)} ${p.note ?? ""}`,
    ),
    "",
    "Collected by:",
    ...(a.by_staff ?? []).map(
      (s: any) =>
        `  ${s.recorded_by_name}: ${s.payment_count} × ${money(Number(s.total), a.currency)}`,
    ),
    "",
    "Manually recorded by your staff — FitForge does not process payments.",
  ].join("\n");

  const subject = `${a.gym_name} — ${a.new_count + a.renewal_count} memberships today, ${money(a.total_collected, a.currency)} collected`;
  return { subject, html, text };
}

async function sendResend(to: string, subject: string, html: string, text: string) {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["SUMMARY_FROM_EMAIL"];
  if (!key || !from) {
    return { ok: false, error: "RESEND_API_KEY or SUMMARY_FROM_EMAIL is not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[daily-summary] Resend failed [${res.status}]: ${body}`);
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("[daily-summary] Resend error", e);
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export type SummaryRunResult = {
  gym_id: string;
  gym_name: string;
  outcome: "sent" | "skipped";
  reason?: string;
  recipients?: number;
  errors?: string[];
};

/**
 * @param opts.gymId    restrict to one gym (the "send me one now" path)
 * @param opts.test     true = only `onlyEmail`, ignore no-activity suppression,
 *                      write NO daily_summary_log row
 * @param opts.force    ignore the gym-local hour match (manual runs)
 */
export async function runDailySummary(opts: {
  gymId?: string;
  test?: boolean;
  onlyEmail?: string;
  force?: boolean;
  duesBaseUrl?: string;
}): Promise<SummaryRunResult[]> {
  const out: SummaryRunResult[] = [];
  const duesUrl = `${opts.duesBaseUrl ?? "https://fitfinity-nexus.lovable.app"}/admin/dues`;

  let q = supabaseAdmin.from("gyms").select("id, name, timezone, is_enabled");
  if (opts.gymId) q = q.eq("id", opts.gymId);
  const { data: gyms, error } = await q;
  if (error) throw new Error(error.message);

  for (const gym of (gyms ?? []) as any[]) {
    const tz = gym.timezone ?? "UTC";
    const today = dateInZone(tz);
    const push = (o: Omit<SummaryRunResult, "gym_id" | "gym_name">) =>
      out.push({ gym_id: gym.id, gym_name: gym.name, ...o });

    if (!gym.is_enabled && !opts.test) {
      push({ outcome: "skipped", reason: "gym_disabled" });
      continue;
    }

    const { data: settings } = await supabaseAdmin
      .from("gym_billing_settings")
      .select("daily_summary_enabled, daily_summary_hour")
      .eq("gym_id", gym.id)
      .maybeSingle();
    const enabled = (settings as any)?.daily_summary_enabled ?? true;
    const hour = (settings as any)?.daily_summary_hour ?? 21;

    if (!opts.test) {
      if (!enabled) {
        await supabaseAdmin
          .from("daily_summary_log")
          .upsert(
            { gym_id: gym.id, summary_date: today, skipped_reason: "disabled", recipient_count: 0 },
            { onConflict: "gym_id,summary_date" },
          );
        push({ outcome: "skipped", reason: "disabled" });
        continue;
      }
      if (!opts.force && hourInZone(tz) !== hour) {
        push({ outcome: "skipped", reason: "not_this_hour" });
        continue;
      }
      // Idempotency guard FIRST: a retried or double-fired cron must not resend.
      const { data: existing } = await supabaseAdmin
        .from("daily_summary_log")
        .select("id")
        .eq("gym_id", gym.id)
        .eq("summary_date", today)
        .maybeSingle();
      if (existing) {
        push({ outcome: "skipped", reason: "already_logged" });
        continue;
      }
    }

    const { data: activity, error: actErr } = await supabaseAdmin.rpc("gym_daily_activity", {
      _gym_id: gym.id,
      _day: today,
    });
    if (actErr) {
      push({ outcome: "skipped", reason: `activity_failed: ${actErr.message}` });
      continue;
    }
    const a = activity as unknown as Activity;

    const quiet =
      Number(a?.new_count ?? 0) === 0 &&
      Number(a?.renewal_count ?? 0) === 0 &&
      Number(a?.refund_count ?? 0) === 0;

    if (quiet && !opts.test) {
      await supabaseAdmin
        .from("daily_summary_log")
        .upsert(
          {
            gym_id: gym.id,
            summary_date: today,
            skipped_reason: "no_activity",
            recipient_count: 0,
          },
          { onConflict: "gym_id,summary_date" },
        );
      push({ outcome: "skipped", reason: "no_activity" });
      continue;
    }

    // Recipients: active ADMINS of this gym only, by their own address.
    let recipients: string[] = [];
    if (opts.test && opts.onlyEmail) {
      recipients = [opts.onlyEmail.toLowerCase()];
    } else {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("gym_id", gym.id)
        .eq("role", "admin");
      const ids = [...new Set(((roles ?? []) as any[]).map((r) => r.user_id))];
      const { data: admins } = ids.length
        ? await supabaseAdmin.from("users").select("email, active").in("id", ids).eq("active", true)
        : { data: [] as any[] };
      recipients = [
        ...new Set(
          ((admins ?? []) as any[])
            .map((u) => (u.email ?? "").toLowerCase())
            .filter((e) => e.includes("@")),
        ),
      ];
    }

    if (!recipients.length) {
      if (!opts.test) {
        await supabaseAdmin.from("daily_summary_log").upsert(
          {
            gym_id: gym.id,
            summary_date: today,
            skipped_reason: "no_recipients",
            recipient_count: 0,
          },
          { onConflict: "gym_id,summary_date" },
        );
      }
      push({ outcome: "skipped", reason: "no_recipients" });
      continue;
    }

    const { subject, html, text } = renderSummaryEmail(a, duesUrl);
    let sent = 0;
    const errors: string[] = [];
    // One email per admin — never several addresses in one To header.
    for (const to of recipients) {
      const res = await sendResend(to, subject, html, text);
      if (res.ok) sent++;
      else errors.push(res.error ?? "unknown");
    }

    if (!opts.test) {
      await supabaseAdmin.from("daily_summary_log").upsert(
        {
          gym_id: gym.id,
          summary_date: today,
          recipient_count: sent,
          skipped_reason: null,
          totals: {
            total_collected: a.total_collected,
            new_count: a.new_count,
            renewal_count: a.renewal_count,
            refund_count: a.refund_count,
          } as any,
        },
        { onConflict: "gym_id,summary_date" },
      );
    }

    push({
      outcome: sent > 0 ? "sent" : "skipped",
      reason: sent > 0 ? undefined : "all_sends_failed",
      recipients: sent,
      errors: errors.length ? errors : undefined,
    });
  }

  return out;
}
