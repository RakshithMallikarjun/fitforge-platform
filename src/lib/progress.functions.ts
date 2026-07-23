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

export type FitnessScore = {
  score: number | null;
  label: string;
  trend: number | null;
  hasAssessment: boolean;
};

function computeAssessmentScore(a: any, streak: number): number | null {
  const parts: { pts: number; weight: number }[] = [];
  if (a.body_fat_pct != null) {
    parts.push({ pts: Math.max(0, 20 - (Number(a.body_fat_pct) - 15) * 0.8), weight: 20 });
  }
  if (a.vo2_max != null) {
    parts.push({ pts: Math.min(20, (Number(a.vo2_max) / 55) * 20), weight: 20 });
  }
  if (a.resting_hr != null) {
    parts.push({ pts: Math.max(0, 20 - (Number(a.resting_hr) - 50) * 0.4), weight: 20 });
  }
  parts.push({ pts: Math.min(20, streak * 1.5), weight: 20 });
  if (a.bench_1rm != null && a.weight != null && Number(a.weight) > 0) {
    parts.push({ pts: Math.min(20, (Number(a.bench_1rm) / Number(a.weight)) * 10), weight: 20 });
  }
  if (parts.length === 0) return null;
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const raw = parts.reduce((s, p) => s + p.pts, 0);
  // Re-weight to 100
  return Math.round((raw / totalWeight) * 100);
}

export const getFitnessScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FitnessScore> => {
    const { supabase, userId } = context;
    const [assessRes, logsRes] = await Promise.all([
      supabase
        .from("fitness_assessments")
        .select("date, weight, body_fat_pct, vo2_max, resting_hr, bench_1rm")
        .eq("member_id", userId)
        .order("date", { ascending: false })
        .limit(2),
      supabase
        .from("workout_logs")
        .select("date, completed_at")
        .eq("member_id", userId)
        .not("completed_at", "is", null)
        .order("date", { ascending: false })
        .limit(60),
    ]);

    // streak calc (same logic as member-home)
    const completedDates = new Set((logsRes.data ?? []).map((l: any) => l.date as string));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);
    let streak = 0;
    let cursor = new Date(today);
    if (completedDates.has(todayStr) || completedDates.has(yestStr)) {
      if (!completedDates.has(todayStr)) cursor = yest;
      while (completedDates.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    const rows = assessRes.data ?? [];
    if (rows.length === 0) {
      return { score: null, label: "No assessment", trend: null, hasAssessment: false };
    }
    const score = computeAssessmentScore(rows[0], streak);
    const prev = rows[1] ? computeAssessmentScore(rows[1], streak) : null;
    const trend = score != null && prev != null ? score - prev : null;
    const label =
      score == null ? "No data" :
      score < 40 ? "Needs Work" :
      score < 70 ? "Building" :
      score < 90 ? "Strong" : "Elite";
    return { score, label, trend, hasAssessment: true };
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

/* ---------------- PROGRESS PHOTOS ---------------- */

export type ProgressPhoto = {
  id: string;
  member_id: string;
  gym_id: string;
  assessment_id: string | null;
  photo_url: string;
  taken_at: string;
  created_at: string;
};

const uploadPhotoSchema = z.object({
  member_id: z.string().uuid(),
  assessment_id: z.string().uuid().nullable().optional(),
  taken_at: z.string().nullable().optional(),
  file_base64: z.string().min(10),
  content_type: z.string().default("image/jpeg"),
  file_ext: z.string().default("jpg"),
});

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const uploadProgressPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => uploadPhotoSchema.parse(d))
  .handler(async ({ data, context }): Promise<ProgressPhoto> => {
    const { supabase, userId } = context;

    // Resolve gym for the member
    const { data: memberRow, error: mErr } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", data.member_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!memberRow?.gym_id) throw new Error("Member gym not found");

    // Permission: self OR trainer/admin (RLS on progress_photos also enforces this)
    if (data.member_id !== userId) {
      const [{ data: roles }, { data: assign }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase
          .from("trainer_assignments")
          .select("id")
          .eq("trainer_id", userId)
          .eq("member_id", data.member_id)
          .eq("active", true)
          .maybeSingle(),
      ]);
      const r = (roles ?? []).map((x: any) => x.role);
      if (!r.includes("admin") && !assign) throw new Error("Forbidden");
    }

    const ext = (data.file_ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `${memberRow.gym_id}/${crypto.randomUUID()}.${ext}`;
    const bytes = base64ToBytes(data.file_base64);

    const { error: upErr } = await supabase.storage
      .from("member-photos")
      .upload(key, bytes, {
        cacheControl: "3600",
        upsert: false,
        contentType: data.content_type || "image/jpeg",
      });
    if (upErr) throw new Error(upErr.message);

    // Store only the storage object path in the database. Consumers mint
    // short-lived signed URLs on read (see getProgressPhotos below).
    const { data: inserted, error: insErr } = await supabase
      .from("progress_photos")
      .insert({
        member_id: data.member_id,
        gym_id: memberRow.gym_id,
        assessment_id: data.assessment_id ?? null,
        photo_url: key,
        taken_at: data.taken_at ?? new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    const { signPhotoValue } = await import("./photo-signing");
    const signed = await signPhotoValue(supabase, key);
    return { ...(inserted as ProgressPhoto), photo_url: signed ?? key };
  });

export const getProgressPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressPhoto[]> => {
    const { data, error } = await context.supabase
      .from("progress_photos")
      .select("*")
      .eq("member_id", context.userId)
      .order("taken_at", { ascending: true });
    if (error) throw new Error(error.message);
    const { signPhotoField } = await import("./photo-signing");
    return (await signPhotoField(context.supabase, (data ?? []) as any[], "photo_url")) as ProgressPhoto[];
  });
