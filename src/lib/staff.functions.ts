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

    // Role is written server-side in one transaction; the signup trigger only ever grants 'member'.
    const { error: rErr } = await context.supabase.rpc("staff_assign_role", {
      _user_id: userId,
      _role: data.role,
      _display_name: data.displayName,
    });
    if (rErr) throw new Error(rErr.message);

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
      .select("id, display_name, email, photo_url, active, created_at, last_sign_in_at")
      .in("id", ids);
    const rolesByUser = new Map<string, Role[]>();
    for (const r of roleRows ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as Role);
      rolesByUser.set(r.user_id, list);
    }
    // Auth Admin API: invite timestamps and whether they ever signed in.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const auth = await Promise.all(
      (users ?? []).map((u: any) => supabaseAdmin.auth.admin.getUserById(u.id)),
    );
    const authById = new Map(auth.map((a) => [a.data.user?.id, a.data.user]));
    return (users ?? []).map((u: any) => {
      const au: any = authById.get(u.id);
      const signedIn = !!(au?.last_sign_in_at ?? u.last_sign_in_at);
      return {
        ...u,
        roles: rolesByUser.get(u.id) ?? [],
        invited: !signedIn,
        invited_at: (au?.invited_at ?? au?.recovery_sent_at ?? u.created_at) as string | null,
      };
    });
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

async function assertPendingStaff(supabase: any, gymId: string, targetId: string) {
  const { data: target } = await supabase
    .from("users")
    .select("gym_id, email, display_name")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.gym_id !== gymId) throw new Error("Not found");
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", targetId)
    .eq("gym_id", gymId);
  const staffRole = (roles ?? []).find((r: any) => r.role === "admin" || r.role === "trainer");
  if (!staffRole) throw new Error("Not a staff member");
  return { ...target, role: staffRole.role as "admin" | "trainer" };
}

const targetSchema = z.object({ userId: z.string().uuid() });

export const resendStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof targetSchema>) => targetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const gymId = await assertAdminGym(context.supabase, context.userId);
    const t = await assertPendingStaff(context.supabase, gymId, data.userId);
    const { sendAccountInvite, inviterName } = await import("@/lib/invites.server");
    await sendAccountInvite({
      email: t.email,
      gymId,
      role: t.role,
      invitedByName: await inviterName(context.userId),
      displayName: t.display_name,
    });
    return { ok: true };
  });

export const cancelStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof targetSchema>) => targetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const gymId = await assertAdminGym(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot cancel yourself");
    await assertPendingStaff(context.supabase, gymId, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (au?.user?.last_sign_in_at) {
      throw new Error("They have already signed in — deactivate them instead.");
    }
    // Deleting the auth user cascades their roles and profile rows.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
