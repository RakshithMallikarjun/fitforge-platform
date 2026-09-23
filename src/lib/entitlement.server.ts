/**
 * Server-side membership entitlement.
 *
 * Paid member features (workout content, logging, history, personal records)
 * must be gated on the server, never only in the client shell. Gym staff and
 * members whose gym does not set an expiry date are always allowed; a member
 * whose expiry date has passed in the gym's own timezone is refused.
 */
import { dateStringInZone, resolveGymTimezone } from "@/lib/gym-date";
import { isMembershipExpired } from "@/lib/membership";

export const MEMBERSHIP_EXPIRED_MESSAGE =
  "Your membership has expired. Please renew at your gym to continue.";

/** Throws when the caller is a member whose membership has lapsed. */
export async function requireActiveMembership(supabase: any, userId: string): Promise<void> {
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
  if (roles.includes("admin") || roles.includes("trainer")) return;

  const { timeZone } = await resolveGymTimezone(supabase, userId);
  const today = dateStringInZone(timeZone);

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("membership_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  const expiresAt =
    (profile as { membership_expires_at?: string | null } | null)?.membership_expires_at ?? null;

  if (isMembershipExpired(expiresAt, today)) throw new Error(MEMBERSHIP_EXPIRED_MESSAGE);
}
