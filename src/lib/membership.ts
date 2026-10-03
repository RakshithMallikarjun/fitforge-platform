/**
 * The one definition of "active" for members. Used by the gym dashboard, the
 * platform console (mirrored in SQL inside public.platform_gyms) and the member
 * shell, so every surface counts and labels the same thing.
 *
 *   Active account    = users.active = true
 *   Active membership = active account AND (no ledger end date OR latest
 *                       member_subscriptions.ends_on >= today in the gym's timezone)
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

/**
 * The ONE membership status, used by every screen (Members, profile, Dues,
 * dashboard, Revenue, member card).
 *   none          never paid
 *   active        paid through a date beyond the reminder window
 *   expiring      paid, ends within the gym's reminder lead days ("Expiring soon")
 *   overdue_grace ended, still inside the gym's grace days ("Overdue · grace")
 *   expired       ended and past grace
 *   cancelled     latest membership was cancelled and has ended
 *   inactive      account deactivated
 * Only active + expiring count as "Active memberships".
 */
export type LedgerStatus =
  | "none"
  | "active"
  | "expiring"
  | "overdue_grace"
  | "expired"
  | "cancelled"
  | "inactive";

export function countsAsActiveMembership(s: LedgerStatus) {
  return s === "active" || s === "expiring";
}

function dayDiff(a: string, b: string) {
  return Math.round(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000,
  );
}

export function membershipState(o: {
  accountActive: boolean;
  endsOn: string | null;
  today: string;
  leadDays: number;
  graceDays: number;
  cancelled?: boolean;
}): LedgerStatus {
  if (!o.accountActive) return "inactive";
  if (!o.endsOn) return "none";
  const days = dayDiff(o.endsOn, o.today);
  if (days < 0) {
    if (o.cancelled) return "cancelled";
    return -days <= o.graceDays ? "overdue_grace" : "expired";
  }
  return days <= o.leadDays ? "expiring" : "active";
}
export type LedgerMembership = {
  planName: string | null;
  endsOn: string | null;
  legacy: boolean;
  status: LedgerStatus;
};

/** Same thresholds as Dues: "expiring" means within the gym's reminder lead days. */
export function ledgerStatus(
  accountActive: boolean,
  endsOn: string | null,
  today: string,
  leadDays: number,
  graceDays = 0,
  cancelled = false,
): LedgerStatus {
  return membershipState({ accountActive, endsOn, today, leadDays, graceDays, cancelled });
}
