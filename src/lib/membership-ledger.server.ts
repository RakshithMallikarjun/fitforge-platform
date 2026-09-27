import { dateStringInZone } from "@/lib/gym-date";
import { ledgerStatus, type LedgerMembership } from "@/lib/membership";

/**
 * Current membership per member, read from member_subscriptions (the ledger).
 * Every staff surface uses this so the Members list, profile and Dues agree.
 */
export async function ledgerMemberships(
  supabase: any,
  gymId: string,
  members: { id: string; active: boolean }[],
): Promise<Map<string, LedgerMembership>> {
  const out = new Map<string, LedgerMembership>();
  if (!members.length) return out;
  const ids = members.map((m) => m.id);
  const [{ data: gym }, { data: settings }, { data: subs }] = await Promise.all([
    supabase.from("gyms").select("timezone").eq("id", gymId).maybeSingle(),
    supabase.from("gym_billing_settings").select("reminder_lead_days").eq("gym_id", gymId).maybeSingle(),
    supabase
      .from("member_subscriptions")
      .select("member_id, plan_name_snapshot, ends_on, source, state")
      .in("member_id", ids)
      .in("state", ["active", "expired"])
      .order("ends_on", { ascending: false }),
  ]);
  const today = dateStringInZone((gym as any)?.timezone || "UTC");
  const lead = (settings as any)?.reminder_lead_days ?? 7;
  const latest = new Map<string, any>();
  for (const s of (subs ?? []) as any[]) if (!latest.has(s.member_id)) latest.set(s.member_id, s);
  for (const m of members) {
    const s = latest.get(m.id);
    out.set(m.id, {
      planName: s?.plan_name_snapshot ?? null,
      endsOn: s?.ends_on ?? null,
      legacy: s?.source === "imported",
      status: ledgerStatus(m.active, s?.ends_on ?? null, today, lead),
    });
  }
  return out;
}
