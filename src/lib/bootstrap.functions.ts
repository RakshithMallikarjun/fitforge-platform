import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One-time bootstrap: lets the FIRST user against a gym claim admin.
 * Once any admin exists for that gym, this path locks out.
 *
 * Public sign-up never grants admin — this is the controlled bootstrap path.
 */
export const gymHasAdmin = createServerFn({ method: "GET" })
  .inputValidator((d: { gymSlug: string }) => z.object({ gymSlug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: gym } = await supabaseAdmin
      .from("gyms")
      .select("id")
      .eq("slug", data.gymSlug)
      .maybeSingle();
    if (!gym) return { gymExists: false, hasAdmin: false, gymId: null as string | null };
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("gym_id", gym.id)
      .eq("role", "admin")
      .limit(1);
    return { gymExists: true, hasAdmin: (existing ?? []).length > 0, gymId: gym.id };
  });

export const claimGymAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gymSlug: string }) => z.object({ gymSlug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: gym, error: gErr } = await supabaseAdmin
      .from("gyms")
      .select("id, slug")
      .eq("slug", data.gymSlug)
      .maybeSingle();
    if (gErr || !gym) throw new Error("Gym not found");

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("gym_id", gym.id)
      .eq("role", "admin")
      .limit(1);
    if ((existing ?? []).length > 0) {
      throw new Error("This gym already has an admin — ask them to invite you instead.");
    }

    // Ensure user.gym_id matches
    const { error: uErr } = await supabaseAdmin
      .from("users")
      .update({ gym_id: gym.id })
      .eq("id", userId);
    if (uErr) throw new Error(uErr.message);

    // Insert admin role (idempotent on UNIQUE(user_id, role))
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, gym_id: gym.id, role: "admin" });
    if (rErr && !/duplicate key/i.test(rErr.message)) throw new Error(rErr.message);

    return { ok: true, gymId: gym.id };
  });
