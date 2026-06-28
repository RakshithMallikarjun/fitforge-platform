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

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
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
        "id, name, member_id, status, start_date, duration_weeks, is_template, created_at, users:member_id(display_name, email), workout_days(id)",
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
      member_name: r.users?.display_name ?? r.users?.email ?? null,
      status: r.status,
      start_date: r.start_date,
      duration_weeks: r.duration_weeks,
      is_template: r.is_template,
      day_count: (r.workout_days ?? []).length,
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
        "*, users:member_id(display_name, email, photo_url), workout_days(id, day_label, order, workout_exercises(id, exercise_id, sets, reps, rest_seconds, tempo, notes, order, exercises(id, name, thumbnail_url, muscle_groups, equipment)))",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Not found");
    const days = (plan.workout_days ?? [])
      .slice()
      .sort((a: any, b: any) => a.order - b.order)
      .map((d: any) => ({
        ...d,
        workout_exercises: (d.workout_exercises ?? []).slice().sort((a: any, b: any) => a.order - b.order),
      }));
    return { ...plan, workout_days: days } as any;
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

    // For templates without an assigned member, store member_id = caller (trainer/admin owns it).
    const memberId = data.member_id ?? userId;

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
        status: data.is_template ? "draft" : "active",
      })
      .select("id")
      .single();
    if (planErr) throw new Error(planErr.message);

    for (let i = 0; i < data.days.length; i++) {
      const d = data.days[i];
      const { data: day, error: dayErr } = await supabase
        .from("workout_days")
        .insert({ plan_id: plan.id, day_label: d.day_label, order: i })
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

    const { data: src, error: srcErr } = await supabase
      .from("workout_plans")
      .select(
        "name, duration_weeks, notes, workout_days(id, day_label, order, workout_exercises(exercise_id, sets, reps, rest_seconds, tempo, notes, order))",
      )
      .eq("id", data.planId)
      .maybeSingle();
    if (srcErr || !src) throw new Error(srcErr?.message ?? "Plan not found");

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
    for (let i = 0; i < days.length; i++) {
      const d = days[i] as any;
      const { data: newDay, error: dErr } = await supabase
        .from("workout_days")
        .insert({ plan_id: plan.id, day_label: d.day_label, order: i })
        .select("id")
        .single();
      if (dErr) throw new Error(dErr.message);
      const exs = (d.workout_exercises ?? []).slice().sort((a: any, b: any) => a.order - b.order);
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
    return { id: plan.id };
  });

export const archivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ planId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
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
    const { supabase } = context;
    const { data: row } = await supabase
      .from("fitness_assessments")
      .select("date, weight, body_fat_pct, bench_1rm, squat_1rm, deadlift_1rm")
      .eq("member_id", data.memberId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row ?? null;
  });
