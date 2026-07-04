import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExerciseSuggestion = {
  exerciseId: string;
  exerciseName: string;
  currentAvg: { weight: number | null; reps: number | null; sets: number };
  suggestedWeight: number | null;
  suggestedReps: number | null;
  reasoning: string;
};

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

/**
 * Analyze the last ~4 weeks of exercise logs for a member across given exercises
 * and ask Gemini for next-week targets. No writes — purely a suggestion feed.
 */
export const suggestOverload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        exerciseIds: z.array(z.string().uuid()).min(1).max(30),
        planId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<ExerciseSuggestion[]> => {
    const { supabase } = context;
    const since = new Date(Date.now() - FOUR_WEEKS_MS).toISOString();

    const [{ data: exRows }, { data: logs }] = await Promise.all([
      supabase.from("exercises").select("id, name").in("id", data.exerciseIds),
      supabase
        .from("exercise_logs")
        .select("exercise_id, set_number, weight, reps, completed, workout_logs!inner(member_id, date)")
        .eq("workout_logs.member_id", data.memberId)
        .in("exercise_id", data.exerciseIds)
        .gte("workout_logs.date", since.slice(0, 10)),
    ]);

    const nameById = new Map<string, string>();
    (exRows ?? []).forEach((r: any) => nameById.set(r.id, r.name));

    // Group logs per exercise -> compute recent averages + a compact history
    const groups = new Map<string, any[]>();
    for (const l of logs ?? []) {
      const arr = groups.get(l.exercise_id) ?? [];
      arr.push(l);
      groups.set(l.exercise_id, arr);
    }

    const summaries = data.exerciseIds.map((exId) => {
      const rows = (groups.get(exId) ?? []).filter((r: any) => r.completed);
      const weights = rows.map((r: any) => Number(r.weight ?? 0)).filter((n) => n > 0);
      const reps = rows.map((r: any) => Number(r.reps ?? 0)).filter((n) => n > 0);
      const avgW = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
      const avgR = reps.length ? reps.reduce((a, b) => a + b, 0) / reps.length : null;
      // one entry per unique date, best set of the day
      const byDate = new Map<string, { w: number; r: number }>();
      for (const r of rows) {
        const d = (r.workout_logs as any)?.date as string | undefined;
        if (!d) continue;
        const w = Number(r.weight ?? 0), rp = Number(r.reps ?? 0);
        const cur = byDate.get(d);
        if (!cur || w * rp > cur.w * cur.r) byDate.set(d, { w, r: rp });
      }
      const history = Array.from(byDate.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .slice(-8)
        .map(([d, v]) => ({ date: d, weight: v.w, reps: v.r }));
      return {
        exerciseId: exId,
        exerciseName: nameById.get(exId) ?? "Exercise",
        avgWeight: avgW,
        avgReps: avgR,
        sessionCount: byDate.size,
        history,
      };
    });

    const hasData = summaries.some((s) => s.sessionCount >= 2);
    if (!hasData) {
      // Not enough history — return baseline suggestion
      return summaries.map((s) => ({
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        currentAvg: { weight: s.avgWeight, reps: s.avgReps, sets: s.sessionCount },
        suggestedWeight: s.avgWeight,
        suggestedReps: s.avgReps,
        reasoning: "Not enough recent data — keep current numbers and build a baseline.",
      }));
    }

    const { chatCompletion } = await import("./ai-gateway.server");
    const prompt = `You are a strength coach. For each exercise, propose next week's target weight (kg) and reps.
Rules:
- If sessions show progression (weight or reps trending up over 2+ sessions), increase weight by 2.5-5%.
- If plateaued (no progress in 2+ weeks), suggest a small deload (~10%) OR keep weight and add 1 rep.
- Round weight to nearest 2.5 kg.
- Keep reps in a similar range to the athlete's recent work.
- Return ONLY valid JSON — no prose, no markdown fences.

Data:
${JSON.stringify(summaries, null, 2)}

Return JSON:
{
  "suggestions": [
    { "exerciseId": "<uuid>", "suggestedWeight": <number>, "suggestedReps": <number>, "reasoning": "<one short sentence>" }
  ]
}`;

    let parsed: { suggestions?: Array<{ exerciseId: string; suggestedWeight: number; suggestedReps: number; reasoning: string }> } = {};
    try {
      const text = await chatCompletion({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You return only valid JSON matching the requested schema." },
          { role: "user", content: prompt },
        ],
        responseFormat: "json_object",
      });
      parsed = JSON.parse(text);
    } catch (e: any) {
      // Fall back to a heuristic +2.5% bump so the UI still works.
      return summaries.map((s) => {
        const bumped = s.avgWeight ? Math.round((s.avgWeight * 1.025) / 2.5) * 2.5 : null;
        return {
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          currentAvg: { weight: s.avgWeight, reps: s.avgReps, sets: s.sessionCount },
          suggestedWeight: bumped,
          suggestedReps: s.avgReps ? Math.round(s.avgReps) : null,
          reasoning: `AI unavailable (${e?.message?.slice(0, 60) ?? "error"}) — heuristic +2.5%.`,
        };
      });
    }

    const map = new Map(
      (parsed.suggestions ?? []).map((x) => [x.exerciseId, x]),
    );

    return summaries.map((s) => {
      const ai = map.get(s.exerciseId);
      return {
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        currentAvg: { weight: s.avgWeight, reps: s.avgReps, sets: s.sessionCount },
        suggestedWeight: ai?.suggestedWeight ?? s.avgWeight,
        suggestedReps: ai?.suggestedReps ?? (s.avgReps ? Math.round(s.avgReps) : null),
        reasoning: ai?.reasoning ?? "Maintain current load.",
      };
    });
  });

/** Persist an approved suggestion so it surfaces on the member's home. */
export const saveApprovedSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        memberId: z.string().uuid(),
        exerciseId: z.string().uuid(),
        suggestion: z.object({
          suggestedWeight: z.number().nullable(),
          suggestedReps: z.number().nullable(),
          reasoning: z.string(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("overload_suggestions")
      .insert({
        plan_id: data.planId,
        member_id: data.memberId,
        exercise_id: data.exerciseId,
        suggestion: data.suggestion,
        approved_at: new Date().toISOString(),
        approved_by: userId,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Fetch the most recent approved suggestion(s) for the current member's active plan. */
export const getMemberTip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("overload_suggestions")
      .select("id, suggestion, exercise_id, exercises(name)")
      .eq("member_id", userId)
      .not("approved_at", "is", null)
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: (data as any).id as string,
      exerciseName: (data as any).exercises?.name ?? "your next lift",
      suggestion: (data as any).suggestion,
    };
  });
