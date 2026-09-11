import { createContext, useContext } from "react";
import type { MembershipStatus } from "@/lib/membership.functions";

const MembershipContext = createContext<MembershipStatus | null>(null);

export function MembershipProvider({
  value,
  children,
}: {
  value: MembershipStatus | null;
  children: React.ReactNode;
}) {
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

/** Membership state for the signed-in member; null until loaded. */
export function useMembership(): MembershipStatus | null {
  return useContext(MembershipContext);
}

/** True only once we know the membership has lapsed. */
export function useMembershipExpired(): boolean {
  return useMembership()?.expired === true;
}
