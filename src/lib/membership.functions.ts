import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dateStringInZone, resolveGymTimezone } from "@/lib/gym-date";
import { isMembershipExpired } from "@/lib/membership";

export type MembershipStatus = {
  expiresAt: string | null;
  expired: boolean;
  gymName: string | null;
  today: string;
};

/** Membership state for the signed-in member, resolved in the gym's timezone. */
export const getMembershipStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MembershipStatus> => {
    const { supabase, userId } = context;
    const { timeZone, gymId } = await resolveGymTimezone(supabase, userId);
    const today = dateStringInZone(timeZone);

    const { ledgerEndsOn } = await import("@/lib/membership-ledger.server");
    const [ends, { data: gym }] = await Promise.all([
      ledgerEndsOn(supabase, [userId]),
      gymId
        ? supabase.from("gyms").select("name").eq("id", gymId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const expiresAt = ends.get(userId) ?? null;

    return {
      expiresAt,
      expired: isMembershipExpired(expiresAt, today),
      gymName: (gym as { name?: string } | null)?.name ?? null,
      today,
    };
  });
