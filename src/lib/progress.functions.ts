import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProgressAssessment = {
  date: string;
  weight: number | null;
  body_fat_pct: number | null;
  muscle_mass: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  bench_1rm: number | null;
  squat_1rm: number | null;
  deadlift_1rm: number | null;
  unit_system: string | null;
};

export type ProgressExerciseLog = {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  date: string;
};

export type ProgressWorkoutHistory = {
  id: string;
  date: string;
  completed_at: string | null;
  effort_rating: number | null;
  notes: string | null;
  day_label: string | null;
  plan_name: string | null;
  exercise_count: number;
};

export type Goal = {
  id: string;
  name: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  target_date: string | null;
  achieved_at: string | null;
  created_at: string;
};

export type ProgressData = {
  assessments: ProgressAssessment[];
  exerciseLogs: ProgressExerciseLog[];
  history: ProgressWorkoutHistory[];
  goals: Goal[];
};

export const getProgressData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressData> => {
    const { supabase, userId } = context;

    const [assessRes, logsRes, workoutRes, goalsRes] = await Promise.all([
      supabase
        .from("fitness_assessments")
        .select(
          "date, weight, body_fat_pct, muscle_mass, chest, waist, hips, bench_1rm, squat_1rm, deadlift_1rm, unit_system",
        )
        .eq("member_id", userId)
        .order("date", { ascending: true }),
      supabase
        .from("exercise_logs")
        .select(
          "id, workout_log_id, exercise_id, set_number, weight, reps, completed, exercises(name), workout_logs!inner(date, member_id)",
        )
        .eq("workout_logs.member_id", userId)
        .eq("completed", true)
        .order("id", { ascending: false })
        .limit(2000),
      supabase
        .from("workout_logs")
        .select(
          "id, date, completed_at, effort_rating, notes, workout_days(day_label, workout_plans(name)), exercise_logs(id)",
        )
        .eq("member_id", userId)
        .not("completed_at", "is", null)
        .order("date", { ascending: false })
        .limit(200),
      supabase
        .from("goals")
        .select("*")
        .eq("member_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (assessRes.error) throw new Error(assessRes.error.message);
    if (logsRes.error) throw new Error(logsRes.error.message);
    if (workoutRes.error) throw new Error(workoutRes.error.message);
    if (goalsRes.error) throw new Error(goalsRes.error.message);

    const exerciseLogs: ProgressExerciseLog[] = (logsRes.data ?? []).map((r: any) => ({
      id: r.id,
      workout_log_id: r.workout_log_id,
      exercise_id: r.exercise_id,
      exercise_name: r.exercises?.name ?? "Exercise",
      set_number: r.set_number,
      weight: r.weight,
      reps: r.reps,
      completed: r.completed,
      date: r.workout_logs?.date ?? "",
    }));

    const history: ProgressWorkoutHistory[] = (workoutRes.data ?? []).map((r: any) => ({
      id: r.id,
      date: r.date,
      completed_at: r.completed_at,
      effort_rating: r.effort_rating,
      notes: r.notes,
      day_label: r.workout_days?.day_label ?? null,
      plan_name: r.workout_days?.workout_plans?.name ?? null,
      exercise_count: Array.isArray(r.exercise_logs) ? r.exercise_logs.length : 0,
    }));

    return {
      assessments: (assessRes.data ?? []) as ProgressAssessment[],
      exerciseLogs,
      history,
      goals: (goalsRes.data ?? []) as Goal[],
    };
  });

const goalInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  target_value: z.number().finite().nullable().optional(),
  current_value: z.number().finite().nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  target_date: z.string().nullable().optional(),
});

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => goalInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: user } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.gym_id) throw new Error("No gym");
    const { data: row, error } = await supabase
      .from("goals")
      .insert({
        member_id: userId,
        gym_id: user.gym_id,
        name: data.name,
        target_value: data.target_value ?? null,
        current_value: data.current_value ?? null,
        unit: data.unit ?? null,
        target_date: data.target_date ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          name: z.string().trim().min(1).max(120).optional(),
          target_value: z.number().finite().nullable().optional(),
          current_value: z.number().finite().nullable().optional(),
          unit: z.string().trim().max(20).nullable().optional(),
          target_date: z.string().nullable().optional(),
          achieved_at: z.string().nullable().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("goals")
      .update(data.patch)
      .eq("id", data.id)
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("goals")
      .delete()
      .eq("id", data.id)
      .eq("member_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
