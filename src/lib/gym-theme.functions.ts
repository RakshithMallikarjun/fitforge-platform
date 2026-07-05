import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GymThemePayload = {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
  fontFamily: string;
} | null;

export type GymSettingsRow = {
  id: string;
  name: string;
  slug: string;
  primary_color: string | null;
  logo_url: string | null;
  font_family: string | null;
};

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

/** Admin: read the full gym settings row. */
export const getGymSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GymSettingsRow | null> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: user } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.gym_id) return null;
    const { data: gym, error } = await supabase
      .from("gyms")
      .select("id, name, slug, primary_color, logo_url, font_family")
      .eq("id", user.gym_id)
      .maybeSingle();
    if (error) throw error;
    return (gym as GymSettingsRow) ?? null;
  });

/** Admin: update gym branding. */
export const updateGymSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      name: string;
      primaryColor: string;
      logoUrl?: string | null;
      fontFamily?: string | null;
    }) => {
      if (!data.name?.trim()) throw new Error("Name is required");
      if (!/^#[0-9a-fA-F]{6}$/.test(data.primaryColor))
        throw new Error("Primary colour must be a 6-digit hex like #059669");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<GymSettingsRow> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: user } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.gym_id) throw new Error("No gym linked to this user");
    const { data: gym, error } = await supabase
      .from("gyms")
      .update({
        name: data.name.trim(),
        primary_color: data.primaryColor,
        logo_url: data.logoUrl?.trim() || null,
        font_family: data.fontFamily?.trim() || "Satoshi",
      })
      .eq("id", user.gym_id)
      .select("id, name, slug, primary_color, logo_url, font_family")
      .single();
    if (error) throw error;
    return gym as GymSettingsRow;
  });
