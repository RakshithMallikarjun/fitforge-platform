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
  timezone: string | null;
  custom_domain: string | null;
  subscription_plan: string | null;
  payment_status: string | null;
};

const SETTINGS_COLUMNS =
  "id, name, slug, primary_color, secondary_color, logo_url, font_family, support_email, support_phone, timezone, custom_domain, subscription_plan, payment_status";

/** Resolve the caller's gym, refusing anyone who is not an admin of it. */
async function requireAdminGym(supabase: any, userId: string): Promise<string> {
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
  return user.gym_id as string;
}


/** Fetch the current user's gym theme (member or staff). */
export const getGymTheme = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GymThemePayload> => {
    const { supabase, userId } = context;
    const { data: user } = await supabase
      .from("users")
      .select(
        "gym_id, gyms(name, primary_color, secondary_color, logo_url, font_family, support_email, support_phone)",
      )
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

/**
 * Admin: read the full gym settings row.
 *
 * `subscription_plan`, `payment_status` and `join_code` are deliberately not
 * granted to the `authenticated` role, so those are read with the service-role
 * client AFTER the caller has been verified as an admin of this gym.
 */
export const getGymSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GymSettingsRow | null> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: gym, error } = await supabaseAdmin
      .from("gyms")
      .select(SETTINGS_COLUMNS)
      .eq("id", gymId)
      .maybeSingle();
    if (error) throw error;
    return (gym as unknown as GymSettingsRow) ?? null;
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
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { error } = await supabase
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
      .eq("id", gymId);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: update operational settings (timezone + custom domain). */
export const updateGymOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { timezone: string; customDomain?: string | null }) => {
    if (!data.timezone?.trim()) throw new Error("Timezone is required");
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: data.timezone });
    } catch {
      throw new Error("Unknown timezone");
    }
    const domain = data.customDomain?.trim().toLowerCase() || null;
    if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))
      throw new Error("Enter a bare domain like app.yourgym.com");
    return { timezone: data.timezone.trim(), customDomain: domain };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { error } = await supabase
      .from("gyms")
      .update({ timezone: data.timezone, custom_domain: data.customDomain })
      .eq("id", gymId);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: read the gym's self-service join code. */
export const getGymJoinCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ slug: string; joinCode: string | null }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("gyms")
      .select("slug, join_code")
      .eq("id", gymId)
      .maybeSingle();
    if (error) throw error;
    return { slug: data?.slug ?? "", joinCode: data?.join_code ?? null };
  });

/** Admin: issue a fresh join code, invalidating anything already shared. */
export const regenerateGymJoinCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ joinCode: string }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const joinCode = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("gyms")
      .update({ join_code: joinCode })
      .eq("id", gymId);
    if (error) throw error;
    return { joinCode };
  });

