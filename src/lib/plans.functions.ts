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
    isAdmin: r.includes("admin"),
    isTrainer: r.includes("trainer"),
  };
}

/** Throws unless every listed member exists in the caller's gym. */
async function assertMembersInGym(supabase: any, gymId: string, memberIds: string[]) {
  const { data: rows, error } = await supabase
    .from("users")
    .select("id, gym_id, display_name, email")
    .in("id", memberIds);
  if (error) throw new Error(error.message);
  const byId = new Map<string, any>((rows ?? []).map((r: any) => [r.id, r]));
  for (const id of memberIds) {
    const row = byId.get(id);
    if (!row || row.gym_id !== gymId) throw new Error("Member not found in your gym");
  }
  return byId;
}

/** Retires any plan the member is currently on, so only one stays active. */
async function archiveActivePlans(supabase: any, memberId: string) {
  const { error } = await supabase
    .from("workout_plans")
    .update({ status: "archived" })
    .eq("member_id", memberId)
    .eq("status", "active")
    .eq("is_template", false);
  if (error) throw new Error(error.message);
}

/**
 * Fires the plan-assigned push. There is no DB webhook configured, so the
 * server calls the function directly. Push delivery must never break the
 * assignment itself, so every failure is swallowed after logging.
 */
async function notifyPlanAssigned(memberId: string, planId: string, name: string) {
  try {
    const base = process.env["SUPABASE_URL"];
    const secret = process.env["NOTIFY_WEBHOOK_SECRET"];
    if (!base || !secret) return;
    const res = await fetch(`${base}/functions/v1/notify-plan-assigned`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify({ record: { member_id: memberId, plan_id: planId, name } }),
    });
    if (!res.ok) {
      console.error(`[plans] notify-plan-assigned failed [${res.status}]: ${await res.text()}`);
    }
  } catch (e) {
    console.error("[plans] notify-plan-assigned error", e);
  }
}

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: unknown) =>
      z
        .object({ memberId: z.string().uuid().optional(), templatesOnly: z.boolean().optional() })
        .optional()
        .parse(data) ?? {},
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("workout_plans")
      .select(
        "id, name, member_id, trainer_id, status, start_date, duration_weeks, is_template, created_at, users:member_id(display_name, email), trainer:trainer_id(display_name, email), workout_days(id, workout_exercises(id))",
      )
      .order("created_at", { ascending: false });
    if (data?.memberId) q = q.eq("member_id", data.memberId);
    if (data?.templatesOnly) q = q.eq("is_template", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      member_id: r.member_id,
      member_name: r.member_id ? (r.users?.display_name ?? r.users?.email ?? null) : null,
      trainer_id: r.trainer_id,
      trainer_name: r.trainer?.display_name ?? r.trainer?.email ?? null,
      status: r.status,
      start_date: r.start_date,
      duration_weeks: r.duration_weeks,
      is_template: r.is_template,
      day_count: (r.workout_days ?? []).length,
      exercise_count: (r.workout_days ?? []).reduce(
        (sum: number, d: any) => sum + (d.workout_exercises?.length ?? 0),
        0,
      ),
    }));
  });

export const getPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ planId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: plan, error } = await supabase
      .from("workout_plans")
      .select(
        "*, users:member_id(display_name, email, photo_url), workout_days(id, day_label, block_type, order, hidden_at, workout_exercises(id, exercise_id, sets, reps, rest_seconds, tempo, notes, order, hidden_at, exercises(id, name, thumbnail_url, muscle_groups, equipment)))",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Not found");
    // Hidden rows are kept only so logged sessions stay linked; never show them.
    const days = (plan.workout_days ?? [])
      .filter((d: any) => !d.hidden_at)
      .slice()
      .sort((a: any, b: any) => a.order - b.order)
      .map((d: any) => ({
        ...d,
        workout_exercises: (d.workout_exercises ?? [])
          .filter((e: any) => !e.hidden_at)
          .slice()
          .sort((a: any, b: any) => a.order - b.order),
      }));
    const { count } = await supabase
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", data.planId);
    return { ...plan, workout_days: days, session_count: count ?? 0 } as any;
  });

const exerciseInputSchema = z.object({
  exercise_id: z.string().uuid(),
  sets: z.number().int().nullable().optional(),
  reps: z.string().nullable().optional(),
  rest_seconds: z.number().int().nullable().optional(),
  tempo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const dayInputSchema = z.object({
  day_label: z.string().min(1),
  block_type: z.enum(["warmup", "main", "cooldown"]).default("main"),
  exercises: z.array(exerciseInputSchema).default([]),
});

const createPlanSchema = z.object({
  name: z.string().min(1),
  member_id: z.string().uuid().nullable().optional(),
  start_date: z.string().nullable().optional(),
  duration_weeks: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_template: z.boolean().default(false),
  days: z.array(dayInputSchema).default([]),
});

export const createPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createPlanSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId) throw new Error("No gym");
    if (!isAdmin && !isTrainer) throw new Error("Forbidden");

    // Templates belong to no member: store member_id = null so trainers never
    // show up as their own members in queries that don't filter is_template.
    const memberId = data.is_template ? null : (data.member_id ?? null);
    if (!data.is_template && !memberId) throw new Error("A member is required for a plan");
    if (memberId) {
      const { data: target } = await supabase
        .from("users")
        .select("gym_id")
        .eq("id", memberId)
        .maybeSingle();
      if (!target || (target as any).gym_id !== gymId)
        throw new Error("Member not found in your gym");
      // A member has at most one active plan (enforced by a unique index too).
      await archiveActivePlans(supabase, memberId);
    }

    const { data: plan, error: planErr } = await supabase
      .from("workout_plans")
      .insert({
        gym_id: gymId,
        trainer_id: userId,
        member_id: memberId,
        name: data.name,
        start_date: data.start_date ?? null,
        duration_weeks: data.duration_weeks ?? null,
        notes: data.notes ?? null,
        is_template: data.is_template,
        status: "active",
      })
      .select("id")
      .single();
    if (planErr) throw new Error(planErr.message);

    for (let i = 0; i < data.days.length; i++) {
      const d = data.days[i];
      const { data: day, error: dayErr } = await supabase
        .from("workout_days")
        .insert({ plan_id: plan.id, day_label: d.day_label, block_type: d.block_type, order: i })
        .select("id")
        .single();
      if (dayErr) throw new Error(dayErr.message);
      if (d.exercises.length) {
        const rows = d.exercises.map((e, idx) => ({
          day_id: day.id,
          exercise_id: e.exercise_id,
          sets: e.sets ?? null,
          reps: e.reps ?? null,
          rest_seconds: e.rest_seconds ?? null,
          tempo: e.tempo ?? null,
          notes: e.notes ?? null,
          order: idx,
        }));
        const { error: exErr } = await supabase.from("workout_exercises").insert(rows);
        if (exErr) throw new Error(exErr.message);
      }
    }
    return { id: plan.id };
  });

/** Copies the source plan's days/exercises onto a freshly created plan. */
async function copyPlanContents(supabase: any, planId: string, allDays: any[]) {
  const sortedDays = allDays.filter((d: any) => !d.hidden_at);
  for (let i = 0; i < sortedDays.length; i++) {
    const d = sortedDays[i] as any;
    const { data: newDay, error: dErr } = await supabase
      .from("workout_days")
      .insert({
        plan_id: planId,
        day_label: d.day_label,
        block_type: d.block_type ?? "main",
        order: i,
      })
      .select("id")
      .single();
    if (dErr) throw new Error(dErr.message);
    const exs = (d.workout_exercises ?? [])
      .filter((e: any) => !e.hidden_at)
      .slice().sort((a: any, b: any) => a.order - b.order);
    if (exs.length) {
      const rows = exs.map((e: any, idx: number) => ({
        day_id: newDay.id,
        exercise_id: e.exercise_id,
        sets: e.sets,
        reps: e.reps,
        rest_seconds: e.rest_seconds,
        tempo: e.tempo,
        notes: e.notes,
        order: idx,
      }));
      const { error: exErr } = await supabase.from("workout_exercises").insert(rows);
      if (exErr) throw new Error(exErr.message);
    }
  }
}

export const assignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        memberId: z.string().uuid(),
        startDate: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId || (!isAdmin && !isTrainer)) throw new Error("Forbidden");
    await assertMembersInGym(supabase, gymId, [data.memberId]);

    const { data: src, error: srcErr } = await supabase
      .from("workout_plans")
      .select(
        "name, duration_weeks, notes, workout_days(id, day_label, block_type, order, hidden_at, workout_exercises(exercise_id, sets, reps, rest_seconds, tempo, notes, order, hidden_at))",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (srcErr || !src) throw new Error(srcErr?.message ?? "Plan not found");

    // Retire the member's current plan first: never leave two active plans.
    await archiveActivePlans(supabase, data.memberId);

    const { data: plan, error: planErr } = await supabase
      .from("workout_plans")
      .insert({
        gym_id: gymId,
        trainer_id: userId,
        member_id: data.memberId,
        name: src.name,
        duration_weeks: src.duration_weeks,
        notes: src.notes,
        start_date: data.startDate ?? null,
        is_template: false,
        status: "active",
      })
      .select("id")
      .single();
    if (planErr) throw new Error(planErr.message);

    const days = (src.workout_days ?? []).slice().sort((a: any, b: any) => a.order - b.order);
    try {
      await copyPlanContents(supabase, plan.id, days);
    } catch (e) {
      await supabase.from("workout_plans").delete().eq("id", plan.id);
      throw e;
    }

    await notifyPlanAssigned(data.memberId, plan.id, src.name);
    return { id: plan.id };
  });

export const archivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ planId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId || (!isAdmin && !isTrainer)) throw new Error("Forbidden");

    const { data: plan } = await supabase
      .from("workout_plans")
      .select("id, gym_id")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || (plan as any).gym_id !== gymId) throw new Error("Plan not found in your gym");

    const { error } = await supabase
      .from("workout_plans")
      .update({ status: "archived" })
      .eq("id", data.planId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMemberSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ memberId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Defence in depth: RLS covers this, but never read a member row on the
    // strength of a client-supplied id alone.
    if (data.memberId !== userId) {
      const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
      if (!gymId || (!isAdmin && !isTrainer)) throw new Error("Forbidden");
      const { data: member } = await supabase
        .from("users")
        .select("gym_id")
        .eq("id", data.memberId)
        .maybeSingle();
      if (!member || (member as any).gym_id !== gymId) throw new Error("Forbidden");
      if (!isAdmin) {
        const { data: assignment } = await supabase
          .from("trainer_assignments")
          .select("id")
          .eq("gym_id", gymId)
          .eq("trainer_id", userId)
          .eq("member_id", data.memberId)
          .eq("active", true)
          .maybeSingle();
        if (!assignment) throw new Error("Forbidden");
      }
    }

    const { data: row } = await supabase
      .from("fitness_assessments")
      .select("date, weight, body_fat_pct, bench_1rm, squat_1rm, deadlift_1rm")
      .eq("member_id", data.memberId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row ?? null;
  });

export const bulkAssignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        memberIds: z.array(z.string().uuid()).min(1),
        startDate: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId || (!isAdmin && !isTrainer)) throw new Error("Forbidden");

    // One lookup for every target: validates gym membership and gives us labels.
    const memberById = await assertMembersInGym(supabase, gymId, data.memberIds);

    const { data: src, error: srcErr } = await supabase
      .from("workout_plans")
      .select(
        "name, duration_weeks, notes, workout_days(id, day_label, block_type, order, hidden_at, workout_exercises(exercise_id, sets, reps, rest_seconds, tempo, notes, order, hidden_at))",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (srcErr || !src) throw new Error(srcErr?.message ?? "Plan not found");

    const sortedDays = ((src as any).workout_days ?? [])
      .slice()
      .sort((a: any, b: any) => a.order - b.order);

    let assigned = 0;
    const errors: string[] = [];

    for (const memberId of data.memberIds) {
      const mu = memberById.get(memberId);
      const memberLabel = mu?.display_name ?? mu?.email ?? memberId.slice(0, 8);
      let createdPlanId: string | null = null;
      try {
        await archiveActivePlans(supabase, memberId);

        const { data: plan, error: planErr } = await supabase
          .from("workout_plans")
          .insert({
            gym_id: gymId,
            trainer_id: userId,
            member_id: memberId,
            name: (src as any).name,
            duration_weeks: (src as any).duration_weeks,
            notes: (src as any).notes,
            start_date: data.startDate ?? null,
            is_template: false,
            status: "active",
          })
          .select("id")
          .single();
        if (planErr) throw new Error(planErr.message);
        createdPlanId = plan.id;

        await copyPlanContents(supabase, plan.id, sortedDays);
        assigned++;
        await notifyPlanAssigned(memberId, plan.id, (src as any).name);
      } catch (e: any) {
        // Never leave a half-built plan behind.
        if (createdPlanId) await supabase.from("workout_plans").delete().eq("id", createdPlanId);
        errors.push(`${memberLabel}: ${e?.message ?? "unknown error"}`);
      }
    }

    return { assigned, errors };
  });

export type SessionExerciseLog = {
  name: string;
  substitutedFrom: string | null;
  sets: { set_number: number; weight: number | null; reps: number | null }[];
};
export type PlanSession = {
  id: string;
  date: string;
  day_label: string | null;
  effort_rating: number | null;
  notes: string | null;
  prs: { exercise: string; weight: number; reps: number | null }[];
  exercises: SessionExerciseLog[];
};

/**
 * Completed sessions logged against a plan, newest first. Admins see any plan
 * in their gym; trainers only plans of their assigned members (RLS + explicit check).
 */
export const listPlanSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ planId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<PlanSession[]> => {
    const { supabase, userId } = context;
    const { data: plan, error } = await supabase
      .from("workout_plans")
      .select(
        "id, member_id, workout_days(id, workout_exercises(id, exercise_id, order, exercises(name)))",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan?.member_id) return [];
    const { isAdmin } = await getRolesAndGym(supabase, userId);
    if (!isAdmin) {
      const { data: ok } = await supabase.rpc("is_trainer_of", { _member_id: plan.member_id });
      if (!ok) throw new Error("Forbidden");
    }

    const { data: logs, error: lErr } = await supabase
      .from("workout_logs")
      .select("id, date, effort_rating, notes, workout_day_id, workout_days:workout_day_id(day_label)")
      .eq("plan_id", data.planId)
      .not("completed_at", "is", null)
      .order("date", { ascending: false })
      .order("completed_at", { ascending: false })
      .limit(50);
    if (lErr) throw new Error(lErr.message);
    const logIds = (logs ?? []).map((l: any) => l.id);
    if (!logIds.length) return [];

    const weAll = ((plan as any).workout_days ?? []).flatMap((d: any) =>
      (d.workout_exercises ?? []).map((w: any) => ({ ...w, day_id: d.id })),
    );
    const [{ data: sets }, { data: prs }, { data: subs }] = await Promise.all([
      supabase
        .from("exercise_logs")
        .select("log_id, exercise_id, set_number, weight, reps, completed, exercises(name)")
        .in("log_id", logIds)
        .order("set_number", { ascending: true }),
      supabase
        .from("personal_records")
        .select("log_id, weight, reps, exercises(name)")
        .in("log_id", logIds),
      weAll.length
        ? supabase
            .from("workout_exercise_substitutions")
            .select("original_workout_exercise_id, substitute_exercise_id, exercises:substitute_exercise_id(name)")
            .eq("member_id", plan.member_id)
            .in("original_workout_exercise_id", weAll.map((w: any) => w.id))
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const subByWe = new Map<string, any>((subs ?? []).map((s: any) => [s.original_workout_exercise_id, s]));

    return (logs ?? []).map((l: any) => {
      const logSets = (sets ?? []).filter((s: any) => s.log_id === l.id && s.completed !== false);
      const used = new Set<string>();
      const prescribed = weAll
        .filter((w: any) => w.day_id === l.workout_day_id)
        .sort((a: any, b: any) => a.order - b.order);
      const exercises: SessionExerciseLog[] = prescribed.map((w: any) => {
        const sub = subByWe.get(w.id);
        const subSets = sub ? logSets.filter((s: any) => s.exercise_id === sub.substitute_exercise_id) : [];
        const useSub = sub && subSets.length > 0;
        const exId = useSub ? sub.substitute_exercise_id : w.exercise_id;
        used.add(exId);
        const mine = logSets.filter((s: any) => s.exercise_id === exId);
        return {
          name: useSub ? (sub.exercises?.name ?? "Exercise") : (w.exercises?.name ?? "Exercise"),
          substitutedFrom: useSub ? (w.exercises?.name ?? null) : null,
          sets: mine.map((s: any) => ({ set_number: s.set_number, weight: s.weight, reps: s.reps })),
        };
      });
      // Anything logged that wasn't in the prescription (e.g. older swaps).
      const extra = new Map<string, SessionExerciseLog>();
      for (const s of logSets as any[]) {
        if (used.has(s.exercise_id)) continue;
        const e: SessionExerciseLog = extra.get(s.exercise_id) ?? { name: s.exercises?.name ?? "Exercise", substitutedFrom: null, sets: [] as SessionExerciseLog["sets"] };
        e.sets.push({ set_number: s.set_number, weight: s.weight, reps: s.reps });
        extra.set(s.exercise_id, e);
      }
      return {
        id: l.id,
        date: l.date,
        day_label: l.workout_days?.day_label ?? null,
        effort_rating: l.effort_rating,
        notes: l.notes,
        prs: (prs ?? [])
          .filter((p: any) => p.log_id === l.id)
          .map((p: any) => ({ exercise: p.exercises?.name ?? "Exercise", weight: Number(p.weight), reps: p.reps })),
        exercises: [...exercises, ...extra.values()],
      };
    });
  });
