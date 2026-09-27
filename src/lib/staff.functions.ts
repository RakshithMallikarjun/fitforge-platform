import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "trainer" | "member";

async function assertAdminGym(supabase: any, userId: string): Promise<string> {
  const { data: u } = await supabase.from("users").select("gym_id").eq("id", userId).maybeSingle();
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) throw new Error("Forbidden: admin only");
  if (!u?.gym_id) throw new Error("No gym");
  return u.gym_id as string;
}

const staffInputSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(["admin", "trainer"]),
});

export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof staffInputSchema>) => staffInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const gymId = await assertAdminGym(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendAccountInvite, inviterName } = await import("@/lib/invites.server");
    const { userId } = await sendAccountInvite({
      email: data.email,
      gymId,
      role: data.role,
      invitedByName: await inviterName(context.userId),
      displayName: data.displayName,
    });

    // The signup trigger always creates a member; staff get their real role here.
    await supabaseAdmin.from("member_profiles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "member");
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, gym_id: gymId, role: data.role });
    if (rErr && !/duplicate key/i.test(rErr.message)) throw new Error(rErr.message);
    await supabaseAdmin
      .from("users")
      .update({ display_name: data.displayName, gym_id: gymId })
      .eq("id", userId);

    return { id: userId };
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const gymId = await assertAdminGym(context.supabase, context.userId);
    const { supabase } = context;
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("gym_id", gymId)
      .in("role", ["admin", "trainer"]);
    const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
    if (!ids.length) return [];
    const { data: users } = await supabase
      .from("users")
      .select("id, display_name, email, photo_url, active, created_at")
      .in("id", ids);
    const rolesByUser = new Map<string, Role[]>();
    for (const r of roleRows ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as Role);
      rolesByUser.set(r.user_id, list);
    }
    return (users ?? []).map((u: any) => ({ ...u, roles: rolesByUser.get(u.id) ?? [] }));
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const gymId = await assertAdminGym(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot change your own active status");
    // Ensure target is in the same gym
    const { data: target } = await context.supabase
      .from("users")
      .select("gym_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.gym_id !== gymId) throw new Error("Not found");
    const { error } = await context.supabase
      .from("users")
      .update({ active: data.active })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
