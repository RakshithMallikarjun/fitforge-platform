import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkoutDayExercise = {
  id: string; // workout_exercises.id
  order: number;
  sets: number;
  reps: string | null;
  rest_seconds: number;
  notes: string | null;
  tempo: string | null;
  exercise: {
    id: string;
    name: string;
    muscle_groups: string[];
    video_url: string | null;
    thumbnail_url: string | null;
    description: string | null;
  };
};

export type BlockType = "warmup" | "main" | "cooldown";

export type WorkoutDayData = {
  day: { id: string; day_label: string; order: number; plan_id: string; block_type: BlockType };
  plan: { id: string; name: string } | null;
  exercises: WorkoutDayExercise[];
};

export const getWorkoutDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dayId: string }) => d)
  .handler(async ({ data, context }): Promise<WorkoutDayData> => {
    const { supabase } = context;
    const { data: day, error: dayErr } = await supabase
      .from("workout_days")
      .select("id, day_label, order, plan_id, workout_plans:plan_id(id, name)")
      .eq("id", data.dayId)
      .maybeSingle();
    if (dayErr || !day) throw new Error(dayErr?.message ?? "Day not found");

    const { data: rows, error: exErr } = await supabase
      .from("workout_exercises")
      .select(
        "id, order, sets, reps, rest_seconds, notes, tempo, exercises(id, name, muscle_groups, video_url, thumbnail_url, description)",
      )
      .eq("day_id", data.dayId)
      .order("order", { ascending: true });
    if (exErr) throw new Error(exErr.message);

    const exercises: WorkoutDayExercise[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      order: r.order ?? 0,
      sets: r.sets ?? 3,
      reps: r.reps,
      rest_seconds: r.rest_seconds ?? 60,
      notes: r.notes,
      tempo: r.tempo,
      exercise: {
        id: r.exercises?.id,
        name: r.exercises?.name ?? "Exercise",
        muscle_groups: r.exercises?.muscle_groups ?? [],
        video_url: r.exercises?.video_url ?? null,
        thumbnail_url: r.exercises?.thumbnail_url ?? null,
        description: r.exercises?.description ?? null,
      },
    }));

    return {
      day: {
        id: (day as any).id,
        day_label: (day as any).day_label,
        order: (day as any).order ?? 0,
        plan_id: (day as any).plan_id,
      },
      plan: (day as any).workout_plans
        ? { id: (day as any).workout_plans.id, name: (day as any).workout_plans.name }
        : null,
      exercises,
    };
  });

export type PrevSet = { set_number: number; weight: number | null; reps: number | null };

export const getPreviousSetValues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { exerciseId: string }) => d)
  .handler(async ({ data, context }): Promise<PrevSet[]> => {
    const { supabase, userId } = context;
    // exercise_logs has no member_id — join via workout_logs to filter to this member.
    const { data: rows, error } = await supabase
      .from("exercise_logs")
      .select("set_number, weight, reps, created_at, workout_logs!inner(member_id)")
      .eq("exercise_id", data.exerciseId)
      .eq("workout_logs.member_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);

    // Take the most recent value per set_number, then first 3 sets
    const bySet = new Map<number, PrevSet>();
    for (const r of rows ?? []) {
      const sn = (r as any).set_number as number;
      if (!bySet.has(sn)) {
        bySet.set(sn, { set_number: sn, weight: (r as any).weight, reps: (r as any).reps });
      }
    }
    return Array.from(bySet.values())
      .sort((a, b) => a.set_number - b.set_number)
      .slice(0, 6);
  });

export const startWorkoutLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string | null; workoutDayId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", userId)
      .maybeSingle();
    if (uErr || !user?.gym_id) throw new Error("Could not resolve gym");

    const today = new Date().toISOString().slice(0, 10);
    // Reuse an in-progress log for the same day if present
    const { data: existing } = await supabase
      .from("workout_logs")
      .select("id")
      .eq("member_id", userId)
      .eq("workout_day_id", data.workoutDayId)
      .eq("date", today)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) return { logId: existing.id as string };

    const { data: ins, error } = await supabase
      .from("workout_logs")
      .insert({
        gym_id: user.gym_id,
        member_id: userId,
        plan_id: data.planId,
        workout_day_id: data.workoutDayId,
        date: today,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { logId: ins.id as string };
  });

export const logSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      logId: string;
      exerciseId: string;
      setNumber: number;
      weight: number | null;
      reps: number | null;
      completed: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Manual upsert: find existing row for (log_id, exercise_id, set_number)
    const { data: existing } = await supabase
      .from("exercise_logs")
      .select("id")
      .eq("log_id", data.logId)
      .eq("exercise_id", data.exerciseId)
      .eq("set_number", data.setNumber)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("exercise_logs")
        .update({
          weight: data.weight,
          reps: data.reps,
          completed: data.completed,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id as string };
    }
    const { data: ins, error } = await supabase
      .from("exercise_logs")
      .insert({
        log_id: data.logId,
        exercise_id: data.exerciseId,
        set_number: data.setNumber,
        weight: data.weight,
        reps: data.reps,
        completed: data.completed,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const completeWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { logId: string; notes: string | null; effortRating: number | null }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("workout_logs")
      .update({
        completed_at: new Date().toISOString(),
        notes: data.notes,
        effort_rating: data.effortRating,
      })
      .eq("id", data.logId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type WorkoutsBrowserData = {
  activePlan: {
    id: string;
    name: string;
    days: {
      id: string;
      day_label: string;
      order: number;
      exerciseCount: number;
      estimatedMinutes: number;
      muscleGroups: string[];
    }[];
  } | null;
  pastWorkouts: {
    id: string;
    date: string;
    day_label: string | null;
    effort_rating: number | null;
  }[];
};

export const getWorkoutsBrowser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkoutsBrowserData> => {
    const { supabase, userId } = context;

    const { data: plans } = await supabase
      .from("workout_plans")
      .select("id, name")
      .eq("member_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    let activePlan: WorkoutsBrowserData["activePlan"] = null;
    if (plans?.[0]) {
      const { data: days } = await supabase
        .from("workout_days")
        .select(
          "id, day_label, order, workout_exercises(sets, rest_seconds, exercises(muscle_groups))",
        )
        .eq("plan_id", plans[0].id)
        .order("order", { ascending: true });

      activePlan = {
        id: plans[0].id as string,
        name: plans[0].name as string,
        days: (days ?? []).map((d: any) => {
          const exs = d.workout_exercises ?? [];
          const minutes = Math.max(
            10,
            Math.round(
              exs.reduce(
                (a: number, e: any) => a + ((e.sets ?? 3) * (45 + (e.rest_seconds ?? 60))) / 60,
                0,
              ),
            ),
          );
          const muscleGroups = Array.from(
            new Set(
              exs.flatMap((e: any) => (e.exercises?.muscle_groups ?? []) as string[]),
            ),
          ).slice(0, 4) as string[];
          return {
            id: d.id,
            day_label: d.day_label,
            order: d.order ?? 0,
            exerciseCount: exs.length,
            estimatedMinutes: minutes,
            muscleGroups,
          };
        }),
      };
    }

    const { data: logs } = await supabase
      .from("workout_logs")
      .select("id, date, effort_rating, workout_days:workout_day_id(day_label)")
      .eq("member_id", userId)
      .not("completed_at", "is", null)
      .order("date", { ascending: false })
      .limit(10);

    const pastWorkouts = (logs ?? []).map((l: any) => ({
      id: l.id,
      date: l.date,
      day_label: l.workout_days?.day_label ?? null,
      effort_rating: l.effort_rating,
    }));

    return { activePlan, pastWorkouts };
  });
