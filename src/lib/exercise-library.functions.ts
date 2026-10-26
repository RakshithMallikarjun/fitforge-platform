import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { canReadLibraryPlan } from "@/lib/exercise-library";

async function staffScope(supabase: SupabaseClient<Database>, userId: string) {
  const [user, roles] = await Promise.all([
    supabase.from("users").select("gym_id").eq("id", userId).single(),
    supabase.from("user_roles").select("role, gym_id").eq("user_id", userId),
  ]);
  if (user.error || roles.error) throw new Error("Unable to check library access");
  const gymId = user.data.gym_id;
  const gymRoles = roles.data.filter((r) => r.gym_id === gymId);
  const isAdmin = gymRoles.some((r) => r.role === "admin");
  if (!gymId || (!isAdmin && !gymRoles.some((r) => r.role === "trainer"))) throw new Error("Forbidden");
  const assigned = new Set<string>();
  if (!isAdmin) {
    const result = await supabase.from("trainer_assignments").select("member_id").eq("gym_id", gymId).eq("trainer_id", userId).eq("active", true);
    if (result.error) throw new Error("Unable to load assigned members");
    result.data.forEach((r) => assigned.add(r.member_id));
  }
  return { gymId, isAdmin, assigned };
}

export const getLibraryPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await staffScope(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("workout_plans")
      .select("id, name, member_id, is_template, status, notes, users:member_id(display_name), workout_days(id, day_label, order, hidden_at, workout_exercises(id, exercise_id, sets, reps, rest_seconds, order, hidden_at, exercises(name)))")
      .eq("gym_id", scope.gymId).order("name");
    if (error) throw new Error("Unable to load workouts");
    return data.filter((p) => canReadLibraryPlan(scope.isAdmin, p.member_id, p.is_template, scope.assigned)).map((p) => ({
      ...p,
      workout_days: p.workout_days.filter((d) => !d.hidden_at).sort((a,b) => a.order-b.order).map((d) => ({ ...d, workout_exercises: d.workout_exercises.filter((e) => !e.hidden_at).sort((a,b) => a.order-b.order) })),
    }));
  });

export const duplicateLibraryExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ exerciseId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const scope = await staffScope(context.supabase, context.userId);
    if (!scope.isAdmin) throw new Error("Admins only");
    const source = await context.supabase.from("exercises").select("name, description, video_url, thumbnail_url, muscle_groups, equipment, difficulty, tracking").eq("id", data.exerciseId).is("gym_id", null).single();
    if (source.error) throw new Error("Global exercise not found");
    const result = await context.supabase.from("exercises").insert({ ...source.data, gym_id: scope.gymId, created_by: context.userId }).select("id").single();
    if (result.error) throw new Error("Unable to duplicate exercise");
    return result.data;
  });

export const addLibraryExerciseToPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ exerciseId: z.string().uuid(), planId: z.string().uuid(), dayId: z.string().uuid(), sets: z.number().int().min(1).max(10), reps: z.string().trim().min(1).max(20) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const scope = await staffScope(supabase, userId);
    const plan = await supabase.from("workout_plans").select("member_id, is_template, status").eq("id", data.planId).eq("gym_id", scope.gymId).single();
    if (plan.error || !canReadLibraryPlan(scope.isAdmin, plan.data.member_id, plan.data.is_template, scope.assigned) || (!plan.data.is_template && plan.data.status !== "active")) throw new Error("Plan unavailable");
    const day = await supabase.from("workout_days").select("id").eq("id", data.dayId).eq("plan_id", data.planId).is("hidden_at", null).single();
    const exercise = await supabase.from("exercises").select("gym_id").eq("id", data.exerciseId).single();
    if (day.error || exercise.error || (exercise.data.gym_id && exercise.data.gym_id !== scope.gymId)) throw new Error("Exercise or day unavailable");
    const last = await supabase.from("workout_exercises").select("order").eq("day_id", data.dayId).order("order", { ascending: false }).limit(1);
    if (last.error) throw new Error("Unable to load workout day");
    const result = await supabase.from("workout_exercises").insert({ day_id: data.dayId, exercise_id: data.exerciseId, sets: data.sets, reps: data.reps, order: (last.data[0]?.order ?? -1) + 1 });
    if (result.error) throw new Error("Unable to add exercise to plan");
    return { ok: true };
  });