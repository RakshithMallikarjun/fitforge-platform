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

    const [{ data: profile }, { data: gym }] = await Promise.all([
      supabase
        .from("member_profiles")
        .select("membership_expires_at")
        .eq("user_id", userId)
        .maybeSingle(),
      gymId
        ? supabase.from("gyms").select("name").eq("id", gymId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const expiresAt = (profile as { membership_expires_at?: string | null } | null)
      ?.membership_expires_at ?? null;

    return {
      expiresAt,
      expired: isMembershipExpired(expiresAt, today),
      gymName: (gym as { name?: string } | null)?.name ?? null,
      today,
    };
  });
