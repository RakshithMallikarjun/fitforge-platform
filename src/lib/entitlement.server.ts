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
  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
  if (roles.includes("admin") || roles.includes("trainer")) return;

  const { timeZone } = await resolveGymTimezone(supabase, userId);
  const today = dateStringInZone(timeZone);

  const { ledgerEndsOn } = await import("@/lib/membership-ledger.server");
  const expiresAt = (await ledgerEndsOn(supabase, [userId])).get(userId) ?? null;

  if (isMembershipExpired(expiresAt, today)) throw new Error(MEMBERSHIP_EXPIRED_MESSAGE);
}

/** Non-throwing variant for surfaces that stay usable without paid content. */
export async function hasActiveMembership(supabase: any, userId: string): Promise<boolean> {
  try {
    await requireActiveMembership(supabase, userId);
    return true;
  } catch {
    return false;
  }
}
