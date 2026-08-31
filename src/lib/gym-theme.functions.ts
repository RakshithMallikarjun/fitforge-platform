import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GymThemePayload = {
  name: string;
  primaryColor: string;
  secondaryColor: string | null;
  logoUrl: string | null;
  fontFamily: string;
  supportEmail: string | null;
  supportPhone: string | null;
} | null;

export type GymSettingsRow = {
  id: string;
  name: string;
  slug: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  font_family: string | null;
  support_email: string | null;
  support_phone: string | null;
};

/** Fetch the current user's gym theme (member or staff). */
export const getGymTheme = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GymThemePayload> => {
    const { supabase, userId } = context;
    const { data: user } = await supabase
      .from("users")
      .select("gym_id, gyms(name, primary_color, secondary_color, logo_url, font_family, support_email, support_phone)")
      .eq("id", userId)
      .maybeSingle();
    const gym = (user as any)?.gyms;
    if (!gym) return null;
    return {
      name: gym.name,
      primaryColor: gym.primary_color ?? "#059669",
      secondaryColor: gym.secondary_color ?? null,
      logoUrl: gym.logo_url ?? null,
      fontFamily: gym.font_family ?? "Satoshi",
      supportEmail: gym.support_email ?? null,
      supportPhone: gym.support_phone ?? null,
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
      .select("id, name, slug, primary_color, secondary_color, logo_url, font_family, support_email, support_phone")
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
      secondaryColor?: string | null;
      logoUrl?: string | null;
      fontFamily?: string | null;
      supportEmail?: string | null;
      supportPhone?: string | null;
    }) => {
      if (!data.name?.trim()) throw new Error("Name is required");
      if (!/^#[0-9a-fA-F]{6}$/.test(data.primaryColor))
        throw new Error("Primary colour must be a 6-digit hex like #059669");
      if (data.secondaryColor && !/^#[0-9a-fA-F]{6}$/.test(data.secondaryColor))
        throw new Error("Secondary colour must be a 6-digit hex like #0284c7");
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
        secondary_color: data.secondaryColor?.trim() || null,
        logo_url: data.logoUrl?.trim() || null,
        font_family: data.fontFamily?.trim() || "Satoshi",
        support_email: data.supportEmail?.trim() || null,
        support_phone: data.supportPhone?.trim() || null,
      })
      .eq("id", user.gym_id)
      .select("id, name, slug, primary_color, secondary_color, logo_url, font_family, support_email, support_phone")
      .single();
    if (error) throw error;
    return gym as GymSettingsRow;
  });
