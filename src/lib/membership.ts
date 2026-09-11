/**
 * The one definition of "active" for members. Used by the gym dashboard, the
 * platform console (mirrored in SQL inside public.platform_gyms) and the member
 * shell, so every surface counts and labels the same thing.
 *
 *   Active account    = users.active = true
 *   Active membership = active account AND (membership_expires_at IS NULL OR
 *                       membership_expires_at >= today in the gym's timezone)
 */

export const ACTIVE_MEMBERSHIP_DEFINITION =
  "Active memberships: account enabled and membership not past its expiry date (in the gym's timezone). Total: every member account on the gym, enabled or not.";

/** True when a membership expiry date has not passed yet, in the gym's day. */
export function isMembershipCurrent(
  membershipExpiresAt: string | null | undefined,
  todayInGymZone: string,
): boolean {
  if (!membershipExpiresAt) return true;
  return membershipExpiresAt >= todayInGymZone;
}

/** True when the membership lapsed before the gym's today. */
export function isMembershipExpired(
  membershipExpiresAt: string | null | undefined,
  todayInGymZone: string,
): boolean {
  return !isMembershipCurrent(membershipExpiresAt, todayInGymZone);
}
