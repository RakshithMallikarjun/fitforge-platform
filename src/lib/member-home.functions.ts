import { createServerFn } from "@tanstack/react-start";
import { rankMuscleGroups } from "./muscle-groups";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dateStringInZone, shiftDateString, startOfWeekString } from "@/lib/gym-date";

export type MemberHomeData = {
  gym: { name: string; primary_color: string | null; logo_url: string | null } | null;
  displayName: string | null;
  streakDays: number;
  currentStreak: number;
  lastWorkoutDate: string | null;
  weekCompleted: number;
  weekTarget: number;
  weeklyConsistency: number;
  activePlan: { id: string; name: string } | null;
  nextWorkout: {
    dayId: string;
    dayLabel: string;
    exerciseCount: number;
    estimatedMinutes: number;
    muscleGroups: string[];
  } | null;
  latestNote: { body: string; created_at: string; author: string | null } | null;
};


export const getMemberHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberHomeData> => {
    const { supabase, userId } = context;

    const [{ data: userRow }, { data: logs }, { data: plans }, { data: notes }] = await Promise.all([
      supabase
        .from("users")
        .select("display_name, gym_id, gyms(name, primary_color, logo_url, timezone)")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("workout_logs")
        .select("id, date, completed_at, workout_day_id, plan_id")
        .eq("member_id", userId)
        .order("date", { ascending: false })
        .limit(60),
      supabase
        .from("workout_plans")
        .select("id, name, status, created_at")
        .eq("member_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("member_notes")
        .select("body, created_at, author_id, users:author_id(display_name)")
        .eq("member_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const gym = (userRow as any)?.gyms ?? null;
    const displayName = (userRow as any)?.display_name ?? null;

    // All calendar-day math happens in the gym's timezone so that a workout
    // logged at 23:50 local time counts for the member's "today".
    const timeZone = (gym?.timezone as string | null) || "UTC";

    // streak: consecutive days with a completed log ending today or yesterday
    const completedDates = new Set(
      (logs ?? [])
        .filter((l: any) => l.completed_at)
        .map((l: any) => l.date as string),
    );
    const todayStr = dateStringInZone(timeZone);
    const yestStr = shiftDateString(todayStr, -1);
    let streakDays = 0;
    if (completedDates.has(todayStr) || completedDates.has(yestStr)) {
      let cursor = completedDates.has(todayStr) ? todayStr : yestStr;
      while (completedDates.has(cursor)) {
        streakDays++;
        cursor = shiftDateString(cursor, -1);
      }
    }

    // Weekly consistency: percentage of the last 7 days (rolling) with a completed workout
    let weekHitDays = 0;
    for (let i = 0; i < 7; i++) {
      if (completedDates.has(shiftDateString(todayStr, -i))) weekHitDays++;
    }
    const weeklyConsistency = Math.round((weekHitDays / 7) * 100);

    const lastWorkoutDate = (logs ?? []).find((l: any) => l.completed_at)?.date ?? null;

    // weekly progress (Mon–Sun) in the gym's timezone
    const wkStart = startOfWeekString(todayStr);
    const weekCompleted = (logs ?? []).filter(
      (l: any) => l.completed_at && l.date >= wkStart && l.date <= todayStr,
    ).length;


    const activePlan = plans?.[0]
      ? { id: plans[0].id as string, name: plans[0].name as string }
      : null;

    let nextWorkout: MemberHomeData["nextWorkout"] = null;
    if (activePlan) {
      const { data: days } = await supabase
        .from("workout_days")
        .select("id, day_label, order")
        .eq("plan_id", activePlan.id)
        .order("order", { ascending: true });
      const dayList = days ?? [];
      if (dayList.length) {
        // pick the next day after the most recently logged day, else first
        const lastLog = (logs ?? []).find((l: any) => l.plan_id === activePlan.id && l.workout_day_id);
        let nextIdx = 0;
        if (lastLog) {
          const i = dayList.findIndex((d: any) => d.id === lastLog.workout_day_id);
          nextIdx = i >= 0 ? (i + 1) % dayList.length : 0;
        }
        const day = dayList[nextIdx];
        const { data: exs } = await supabase
          .from("workout_exercises")
          .select("sets, rest_seconds, exercises(muscle_groups)")
          .eq("day_id", day.id);
        const exercises = exs ?? [];
        const minutes = Math.max(
          15,
          Math.round(
            exercises.reduce(
              (acc: number, e: any) =>
                acc + ((e.sets ?? 3) * (45 + (e.rest_seconds ?? 60))) / 60,
              0,
            ),
          ),
        );
        const muscleGroups = rankMuscleGroups(
          exercises.flatMap((e: any) => (e.exercises?.muscle_groups ?? []) as string[]),
        );
        nextWorkout = {
          dayId: day.id as string,
          dayLabel: day.day_label as string,
          exerciseCount: exercises.length,
          estimatedMinutes: minutes,
          muscleGroups,
        };
      }
    }

    const noteRow = notes?.[0] as any;
    const latestNote = noteRow
      ? {
          body: noteRow.body as string,
          created_at: noteRow.created_at as string,
          author: noteRow.users?.display_name ?? null,
        }
      : null;

    return {
      gym: gym
        ? { name: gym.name, primary_color: gym.primary_color, logo_url: gym.logo_url }
        : null,
      displayName,
      streakDays,
      currentStreak: streakDays,
      lastWorkoutDate,
      weekCompleted,
      weekTarget: 4,
      weeklyConsistency,
      activePlan,
      nextWorkout,
      latestNote,
    };
  });
