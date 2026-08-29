/**
 * Timezone-aware "today" helpers.
 *
 * Server functions run in the deploy region (UTC), so any date derived from
 * `new Date().toISOString().slice(0, 10)` or `setHours(0,0,0,0)` is the UTC day,
 * not the member's day. For every zone ahead of UTC late-evening activity is
 * attributed to the previous day, which permanently zeroes streaks.
 *
 * All calendar-day logic must go through these helpers with the gym's IANA zone.
 */

export const DEFAULT_TIMEZONE = "UTC";

/** YYYY-MM-DD for `at` (default: now) as seen in `timeZone`. */
export function dateStringInZone(timeZone: string, at: Date = new Date()): string {
  try {
    // 'en-CA' formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  }
}

/** Hour of day (0-23) for `at` as seen in `timeZone`. */
export function hourInZone(timeZone: string, at: Date = new Date()): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(at),
    );
  } catch {
    return at.getUTCHours();
  }
}

/** Shift a YYYY-MM-DD string by whole days without touching timezones. */
export function shiftDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Inclusive list of YYYY-MM-DD strings from start to end. */
export function dateStringRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  // guard against pathological ranges
  for (let i = 0; i < 3650 && cur <= end; i++) {
    out.push(cur);
    cur = shiftDateString(cur, 1);
  }
  return out;
}

/** Monday-based start of the week containing `dateStr`, as YYYY-MM-DD. */
export function startOfWeekString(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const diff = (t.getUTCDay() + 6) % 7; // Monday = 0
  return shiftDateString(dateStr, -diff);
}

/**
 * Resolve the caller's gym IANA timezone. Falls back to UTC when unknown.
 * `supabase` is any client with a `.from()` query builder (RLS applies).
 */
export async function resolveGymTimezone(
  supabase: any,
  userId: string,
): Promise<{ timeZone: string; gymId: string | null }> {
  const { data } = await supabase
    .from("users")
    .select("gym_id, gyms(timezone)")
    .eq("id", userId)
    .maybeSingle();
  const gymId = (data as any)?.gym_id ?? null;
  const tz = (data as any)?.gyms?.timezone as string | null | undefined;
  return { timeZone: tz || DEFAULT_TIMEZONE, gymId };
}
