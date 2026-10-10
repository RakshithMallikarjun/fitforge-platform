import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dateStringInZone, resolveGymTimezone } from "@/lib/gym-date";
import {
  BODY_METRICS,
  goalPercent,
  goalStatus,
  type BodyMetric,
  type GoalDirection,
  type GoalStatus,
  type GoalType,
} from "@/lib/goal-progress";

export type GoalView = {
  id: string;
  name: string;
  goal_type: GoalType;
  exercise_id: string | null;
  exercise_name: string | null;
  metric: BodyMetric | null;
  direction: GoalDirection;
  unit: string | null;
  target_value: number | null;
  start_value: number | null;
  current_value: number | null;
  target_date: string | null;
  achieved_at: string | null;
  percent: number;
  status: GoalStatus;
  created_at: string;
};

const METRICS = Object.keys(BODY_METRICS) as [BodyMetric, ...BodyMetric[]];
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

const goalFields = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  goal_type: z.enum(["strength", "body", "attendance", "custom"]),
  exercise_id: z.string().uuid().nullable().optional(),
  metric: z.enum(METRICS).nullable().optional(),
  direction: z.enum(["up", "down"]).optional(),
  target_value: z.number().finite().positive("Target must be above 0").max(100000),
  current_value: z.number().finite().min(0).max(100000).nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  target_date: dateStr.nullable().optional(),
});

function checkShape(d: z.infer<typeof goalFields>) {
  if (d.goal_type === "strength" && !d.exercise_id) throw new Error("Pick an exercise");
  if (d.goal_type === "body" && !d.metric) throw new Error("Pick a body measurement");
}

async function gymToday(supabase: any, userId: string) {
  const { timeZone } = await resolveGymTimezone(supabase, userId);
  return { timeZone, today: dateStringInZone(timeZone) };
}

/** Current value per goal type, from the member's own logs/assessments/check-ins. */
async function currentValues(supabase: any, userId: string, goals: any[], timeZone: string) {
  const out = new Map<string, number | null>();
  const exIds = [...new Set(goals.filter((g) => g.goal_type === "strength" && g.exercise_id).map((g) => g.exercise_id))];
  const needBody = goals.some((g) => g.goal_type === "body");
  const needAttendance = goals.some((g) => g.goal_type === "attendance");

  const [sets, assess, checks] = await Promise.all([
    exIds.length
      ? supabase
          .from("exercise_logs")
          .select("exercise_id, weight, workout_logs!inner(member_id)")
          .eq("workout_logs.member_id", userId)
          .eq("completed", true)
          .in("exercise_id", exIds)
          .not("weight", "is", null)
          .limit(5000)
      : { data: [] },
    needBody
      ? supabase
          .from("fitness_assessments")
          .select("date, created_at, weight, body_fat_pct, muscle_mass, waist, chest, hips, arms, thighs")
          .eq("member_id", userId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [] },
    needAttendance
      ? supabase
          .from("attendance_logs")
          .select("check_in_at")
          .eq("member_id", userId)
          .gte("check_in_at", new Date(Date.now() - 40 * 86400000).toISOString())
      : { data: [] },
  ]);

  const bestWeight = new Map<string, number>();
  for (const s of (sets.data ?? []) as any[]) {
    const w = Number(s.weight);
    if (w > (bestWeight.get(s.exercise_id) ?? 0)) bestWeight.set(s.exercise_id, w);
  }
  const month = dateStringInZone(timeZone).slice(0, 7);
  const monthCheckins = ((checks.data ?? []) as any[]).filter(
    (c) => dateStringInZone(timeZone, new Date(c.check_in_at)).slice(0, 7) === month,
  ).length;

  for (const g of goals) {
    if (g.goal_type === "strength") out.set(g.id, bestWeight.get(g.exercise_id) ?? null);
    else if (g.goal_type === "body") {
      const row = ((assess.data ?? []) as any[]).find((a) => a[g.metric] != null);
      out.set(g.id, row ? Number(row[g.metric]) : null);
    } else if (g.goal_type === "attendance") out.set(g.id, monthCheckins);
    else out.set(g.id, g.current_value != null ? Number(g.current_value) : null);
  }
  return out;
}

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoalView[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("goals")
      .select("*, exercises:exercise_id(name)")
      .eq("member_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const { timeZone, today } = await gymToday(supabase, userId);
    const current = await currentValues(supabase, userId, rows, timeZone);

    const views: GoalView[] = [];
    for (const g of rows) {
      const cur = current.get(g.id) ?? null;
      const target = g.target_value != null ? Number(g.target_value) : null;
      const start = g.start_value != null ? Number(g.start_value) : null;
      let achievedAt = g.achieved_at as string | null;
      const status = goalStatus({
        current: cur,
        target,
        direction: g.direction,
        targetDate: g.target_date,
        achievedAt,
        today,
      });
      if (status === "achieved" && !achievedAt) {
        achievedAt = new Date().toISOString();
        await supabase.from("goals").update({ achieved_at: achievedAt }).eq("id", g.id).eq("member_id", userId);
      }
      views.push({
        id: g.id,
        name: g.name,
        goal_type: g.goal_type,
        exercise_id: g.exercise_id,
        exercise_name: g.exercises?.name ?? null,
        metric: g.metric,
        direction: g.direction,
        unit: g.unit,
        target_value: target,
        start_value: start,
        current_value: cur,
        target_date: g.target_date,
        achieved_at: achievedAt,
        percent: status === "achieved" ? 100 : goalPercent(cur, target, g.direction, start ?? cur),
        status,
        created_at: g.created_at,
      });
    }
    return views;
  });

export const createGoalV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => goalFields.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    checkShape(data);
    const { data: user } = await supabase.from("users").select("gym_id").eq("id", userId).maybeSingle();
    if (!user?.gym_id) throw new Error("No gym");
    const { timeZone, today } = await gymToday(supabase, userId);
    if (data.target_date && data.target_date < today) throw new Error("Target date must be today or later");

    const direction: GoalDirection =
      data.goal_type === "body" ? (data.direction ?? BODY_METRICS[data.metric!].direction) : "up";
    const unit =
      data.goal_type === "body"
        ? BODY_METRICS[data.metric!].unit
        : data.goal_type === "attendance"
          ? "check-ins"
          : data.goal_type === "strength"
            ? (data.unit ?? "kg")
            : (data.unit ?? null);
    const draft = { id: "new", goal_type: data.goal_type, exercise_id: data.exercise_id ?? null, metric: data.metric ?? null, current_value: data.current_value ?? null };
    const start = (await currentValues(supabase, userId, [draft], timeZone)).get("new") ?? null;

    const { error } = await supabase.from("goals").insert({
      member_id: userId,
      gym_id: user.gym_id,
      name: data.name,
      goal_type: data.goal_type,
      exercise_id: data.goal_type === "strength" ? data.exercise_id : null,
      metric: data.goal_type === "body" ? data.metric : null,
      direction,
      unit,
      target_value: data.target_value,
      current_value: data.goal_type === "custom" ? (data.current_value ?? null) : null,
      start_value: start,
      target_date: data.target_date ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateGoalV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        target_value: z.number().finite().positive("Target must be above 0").max(100000),
        unit: z.string().trim().max(20).nullable(),
        target_date: dateStr.nullable(),
        current_value: z.number().finite().min(0).max(100000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { today } = await gymToday(supabase, userId);
    const { data: g } = await supabase
      .from("goals")
      .select("goal_type, target_date")
      .eq("id", data.id)
      .eq("member_id", userId)
      .maybeSingle();
    if (!g) throw new Error("Goal not found");
    if (data.target_date && data.target_date < today && data.target_date !== g.target_date)
      throw new Error("Target date must be today or later");
    const patch: Record<string, unknown> = {
      name: data.name,
      target_value: data.target_value,
      unit: data.unit,
      target_date: data.target_date,
      achieved_at: null, // re-evaluated on next read against the new target
    };
    if (g.goal_type === "custom" && data.current_value !== undefined) patch.current_value = data.current_value;
    const { error } = await supabase.from("goals").update(patch).eq("id", data.id).eq("member_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoalV2 = createServerFn({ method: "POST" })
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

/** Exercises the member has logged, for the Strength goal picker. */
export const listGoalExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("exercises")
      .select("id, name")
      .order("name")
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string }[];
  });
