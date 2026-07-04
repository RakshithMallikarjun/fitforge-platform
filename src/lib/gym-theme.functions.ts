import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GymThemePayload = {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
  fontFamily: string;
} | null;

/** Fetch the current user's gym theme (member or staff). */
export const getGymTheme = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GymThemePayload> => {
    const { supabase, userId } = context;
    const { data: user } = await supabase
      .from("users")
      .select("gym_id, gyms(name, primary_color, logo_url, font_family)")
      .eq("id", userId)
      .maybeSingle();
    const gym = (user as any)?.gyms;
    if (!gym) return null;
    return {
      name: gym.name,
      primaryColor: gym.primary_color ?? "#059669",
      logoUrl: gym.logo_url ?? null,
      fontFamily: gym.font_family ?? "Satoshi",
    };
  });
