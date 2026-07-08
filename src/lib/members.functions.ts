import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "trainer" | "member";

async function getRolesAndGym(supabase: any, userId: string) {
  const [{ data: u }, { data: roles }] = await Promise.all([
    supabase.from("users").select("gym_id").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const r = (roles ?? []).map((x: any) => x.role as Role);
  return {
    gymId: u?.gym_id as string | null,
    roles: r,
    isAdmin: r.includes("admin"),
    isTrainer: r.includes("trainer"),
  };
}

// =================== READ ===================

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId) return [];

    // Members of this gym (role = member)
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("gym_id", gymId)
      .eq("role", "member");
    let memberIds = (roleRows ?? []).map((r: any) => r.user_id);

    // Trainers see only their assigned members (and not admins-only context)
    if (isTrainer && !isAdmin) {
      const { data: assigns } = await supabase
        .from("trainer_assignments")
        .select("member_id")
        .eq("trainer_id", userId)
        .eq("active", true);
      const allowed = new Set((assigns ?? []).map((a: any) => a.member_id));
      memberIds = memberIds.filter((id: string) => allowed.has(id));
    }
    if (memberIds.length === 0) return [];

    const [{ data: users }, { data: profiles }, { data: assignments }] = await Promise.all([
      supabase
        .from("users")
        .select("id, display_name, email, phone, photo_url, active, created_at")
        .in("id", memberIds),
      supabase
        .from("member_profiles")
        .select("user_id, experience_level, membership_type, membership_expires_at, goals, health_notes, dob, gender")
        .in("user_id", memberIds),
      supabase
        .from("trainer_assignments")
        .select("member_id, trainer_id, active")
        .in("member_id", memberIds)
        .eq("active", true),
    ]);

    const trainerIds = Array.from(new Set((assignments ?? []).map((a: any) => a.trainer_id)));
    const { data: trainers } = trainerIds.length
      ? await supabase.from("users").select("id, display_name, email").in("id", trainerIds)
      : { data: [] as any[] };
    const trainerMap = new Map((trainers ?? []).map((t: any) => [t.id, t]));

    // Last sign-in via admin (best-effort, only for admins)
    let lastSignInMap = new Map<string, string | null>();
    if (isAdmin) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let page = 1;
        // page through up to ~5 pages of 1000 to cover most gyms
        for (let i = 0; i < 5; i++) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) break;
          for (const u of data.users) lastSignInMap.set(u.id, u.last_sign_in_at ?? null);
          if (data.users.length < 1000) break;
          page++;
        }
      } catch { /* ignore */ }
    }

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const assignMap = new Map<string, any[]>();
    for (const a of assignments ?? []) {
      const t = trainerMap.get(a.trainer_id);
      if (!t) continue;
      const list = assignMap.get(a.member_id) ?? [];
      list.push(t);
      assignMap.set(a.member_id, list);
    }

    return (users ?? []).map((u: any) => ({
      ...u,
      profile: profileMap.get(u.id) ?? null,
      trainers: assignMap.get(u.id) ?? [],
      last_sign_in_at: lastSignInMap.get(u.id) ?? null,
    }));
  });

export const listTrainers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { gymId } = await getRolesAndGym(supabase, userId);
    if (!gymId) return [];
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("gym_id", gymId)
      .eq("role", "trainer");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    const { data: users } = await supabase
      .from("users")
      .select("id, display_name, email, photo_url")
      .in("id", ids);
    return users ?? [];
  });

export const getMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId) throw new Error("No gym");

    // Permission: admin OR trainer assigned to this member
    if (!isAdmin) {
      if (!isTrainer) throw new Error("Forbidden");
      const { data: a } = await supabase
        .from("trainer_assignments")
        .select("id")
        .eq("trainer_id", userId)
        .eq("member_id", data.memberId)
        .eq("active", true)
        .maybeSingle();
      if (!a) throw new Error("Forbidden");
    }

    const [{ data: user }, { data: profile }, { data: assigns }, { data: assessments }, { data: plans }, { data: attendance }] = await Promise.all([
      supabase.from("users").select("*").eq("id", data.memberId).maybeSingle(),
      supabase.from("member_profiles").select("*").eq("user_id", data.memberId).maybeSingle(),
      supabase.from("trainer_assignments").select("id, trainer_id, active, assigned_at").eq("member_id", data.memberId).eq("active", true),
      supabase.from("fitness_assessments").select("*").eq("member_id", data.memberId).order("date", { ascending: false }),
      supabase.from("workout_plans").select("*").eq("member_id", data.memberId).order("created_at", { ascending: false }),
      supabase.from("attendance_logs").select("*").eq("member_id", data.memberId).order("check_in_at", { ascending: false }).limit(100),
    ]);

    const trainerIds = (assigns ?? []).map((a: any) => a.trainer_id);
    const { data: trainers } = trainerIds.length
      ? await supabase.from("users").select("id, display_name, email, photo_url").in("id", trainerIds)
      : { data: [] as any[] };

    return {
      user,
      profile,
      trainers: trainers ?? [],
      assessments: assessments ?? [],
      plans: plans ?? [],
      attendance: attendance ?? [],
    };
  });

// =================== NOTES ===================

export const listMemberNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: notes } = await supabase
      .from("member_notes")
      .select("id, body, created_at, author_id")
      .eq("member_id", data.memberId)
      .order("created_at", { ascending: false });
    const ids = Array.from(new Set((notes ?? []).map((n: any) => n.author_id)));
    const { data: authors } = ids.length
      ? await supabase.from("users").select("id, display_name, email").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((authors ?? []).map((a: any) => [a.id, a]));
    return (notes ?? []).map((n: any) => ({ ...n, author: map.get(n.author_id) ?? null }));
  });

export const createMemberNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { gymId } = await getRolesAndGym(supabase, userId);
    if (!gymId) throw new Error("No gym");
    const { error } = await supabase.from("member_notes").insert({
      gym_id: gymId,
      member_id: data.memberId,
      author_id: userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMemberNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("member_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== WRITE / ADMIN ===================

const memberInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  experience_level: z.enum(["beginner", "intermediate", "advanced"]).optional().nullable(),
  medical_history: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  membership_type: z.string().optional().nullable(),
  membership_expires_at: z.string().optional().nullable(),
});
export type MemberInput = z.infer<typeof memberInputSchema>;

async function assertAdmin(supabase: any, userId: string) {
  const { gymId, isAdmin } = await getRolesAndGym(supabase, userId);
  if (!isAdmin) throw new Error("Forbidden: admin only");
  if (!gymId) throw new Error("No gym");
  return gymId;
}

async function inviteOneMember(input: MemberInput, gymId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Need gym slug for handle_new_user trigger metadata
  const { data: gym, error: gErr } = await supabaseAdmin
    .from("gyms")
    .select("slug")
    .eq("id", gymId)
    .maybeSingle();
  if (gErr || !gym) throw new Error("Gym not found");

  const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
    data: {
      gym_slug: gym.slug,
      role: "member",
      display_name: input.name,
    },
  });
  if (invErr || !invited.user) throw new Error(invErr?.message ?? "Invite failed");
  const newId = invited.user.id;

  // Update user fields (trigger created the row already)
  await supabaseAdmin
    .from("users")
    .update({
      display_name: input.name,
      phone: input.phone ?? null,
      photo_url: input.photo_url ?? null,
    })
    .eq("id", newId);

  await supabaseAdmin
    .from("member_profiles")
    .update({
      goals: input.goals ?? null,
      experience_level: input.experience_level ?? null,
      health_notes: input.medical_history ?? null,
      membership_type: input.membership_type ?? null,
      membership_expires_at: input.membership_expires_at || null,
    })
    .eq("user_id", newId);

  return newId;
}

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: MemberInput) => memberInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const gymId = await assertAdmin(context.supabase, context.userId);
    const id = await inviteOneMember(data, gymId);
    return { id };
  });

export const inviteMembersBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { members: MemberInput[] }) => ({ members: z.array(memberInputSchema).parse(d.members) }))
  .handler(async ({ data, context }) => {
    const gymId = await assertAdmin(context.supabase, context.userId);
    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const m of data.members) {
      try {
        await inviteOneMember(m, gymId);
        results.push({ email: m.email, ok: true });
      } catch (e: any) {
        results.push({ email: m.email, ok: false, error: e?.message ?? "Failed" });
      }
    }
    return { results };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; patch: Partial<MemberInput> }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId) throw new Error("No gym");
    if (!isAdmin) {
      if (!isTrainer) throw new Error("Forbidden");
      const { data: a } = await supabase
        .from("trainer_assignments")
        .select("id")
        .eq("trainer_id", userId)
        .eq("member_id", data.memberId)
        .eq("active", true)
        .maybeSingle();
      if (!a) throw new Error("Forbidden");
    }
    const p = data.patch;
    if (p.name !== undefined || p.phone !== undefined || p.photo_url !== undefined) {
      await supabase
        .from("users")
        .update({
          ...(p.name !== undefined ? { display_name: p.name } : {}),
          ...(p.phone !== undefined ? { phone: p.phone } : {}),
          ...(p.photo_url !== undefined ? { photo_url: p.photo_url } : {}),
        })
        .eq("id", data.memberId);
    }
    const profPatch: any = {};
    if (p.goals !== undefined) profPatch.goals = p.goals;
    if (p.experience_level !== undefined) profPatch.experience_level = p.experience_level;
    if (p.medical_history !== undefined) profPatch.health_notes = p.medical_history;
    if (p.membership_type !== undefined) profPatch.membership_type = p.membership_type;
    if (p.membership_expires_at !== undefined) profPatch.membership_expires_at = p.membership_expires_at || null;
    if (Object.keys(profPatch).length) {
      await supabase.from("member_profiles").update(profPatch).eq("user_id", data.memberId);
    }
    return { ok: true };
  });

export const updateMemberMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; membershipType: string; membershipExpiresAt: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId) throw new Error("No gym");
    if (!isAdmin) {
      if (!isTrainer) throw new Error("Forbidden");
      const { data: a } = await supabase
        .from("trainer_assignments")
        .select("id")
        .eq("trainer_id", userId)
        .eq("member_id", data.memberId)
        .eq("active", true)
        .maybeSingle();
      if (!a) throw new Error("Forbidden");
    }
    const { data: updated, error } = await supabase
      .from("member_profiles")
      .update({
        membership_type: data.membershipType,
        membership_expires_at: data.membershipExpiresAt || null,
      })
      .eq("user_id", data.memberId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return updated;
  });

export const setMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("users").update({ active: data.active }).eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignTrainers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; trainerIds: string[] }) => d)
  .handler(async ({ data, context }) => {
    const gymId = await assertAdmin(context.supabase, context.userId);
    const { supabase } = context;

    const { data: existing } = await supabase
      .from("trainer_assignments")
      .select("id, trainer_id, active")
      .eq("member_id", data.memberId);

    const want = new Set<string>(data.trainerIds as string[]);
    const have = new Map<string, any>((existing ?? []).map((r: any) => [r.trainer_id, r]));

    // Deactivate removed
    const toDeactivate = (existing ?? []).filter((r: any) => r.active && !want.has(r.trainer_id));
    if (toDeactivate.length) {
      await supabase
        .from("trainer_assignments")
        .update({ active: false })
        .in("id", toDeactivate.map((r: any) => r.id));
    }
    // Reactivate or insert
    for (const tid of want) {
      const ex = have.get(tid);
      if (ex && !ex.active) {
        await supabase.from("trainer_assignments").update({ active: true }).eq("id", ex.id);
      } else if (!ex) {
        await supabase
          .from("trainer_assignments")
          .insert({ gym_id: gymId, member_id: data.memberId, trainer_id: tid, active: true });
      }
    }
    return { ok: true };
  });
