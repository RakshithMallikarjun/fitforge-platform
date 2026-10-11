import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cleanReasoning, ruleTarget, type Tracking } from "@/lib/overload-rules";
import { dateStringInZone, resolveGymTimezone, zonedDayStartISO } from "@/lib/gym-date";

export type ExerciseSuggestion = {
  exerciseId: string;
  exerciseName: string;
  currentAvg: { weight: number | null; reps: number | null; sets: number };
  tracking?: Tracking;
  currentBestSeconds?: number | null;
  suggestedSeconds?: number | null;
  /** Best logged set in the window (highest estimated 1RM). */
  currentBest: { weight: number; reps: number } | null;
  suggestedWeight: number | null;
  suggestedReps: number | null;
  reasoning: string;
};

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
const DAILY_CALL_CEILING = 40;

/** Model replies are untrusted input — validate before anything reaches the UI. */
const looseNumber = z.preprocess(
  (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null),
  z.number().nullable(),
);
const aiResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        exerciseId: z.string(),
        suggestedWeight: looseNumber.optional(),
        suggestedReps: looseNumber.optional(),
        reasoning: z.string().optional().nullable().transform((v) => v ?? ""),
      }),
    )
    .nullish()
    .transform((v) => v ?? []),
});

/** Clamp a model number to +/-10% of the athlete's own recent average. */
function clampToDelta(
  value: number | null | undefined,
  baseline: number | null,
  maxDeltaPct = 0.1,
): number | null {
  if (baseline == null || baseline <= 0) return null;
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const min = baseline * (1 - maxDeltaPct);
  const max = baseline * (1 + maxDeltaPct);
  return Math.min(max, Math.max(min, value));
}

function roundWeight(n: number | null): number | null {
  return n == null ? null : Math.round(n / 2.5) * 2.5;
}

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
    const { supabase, userId } = context;

    // --- Explicit authorization: caller is the member, or staff in that gym ---
    if (data.memberId !== userId) {
      const [{ data: me }, { data: them }, { data: roles }] = await Promise.all([
        supabase.from("users").select("gym_id").eq("id", userId).maybeSingle(),
        supabase.from("users").select("gym_id").eq("id", data.memberId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      const staff = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "trainer");
      if (!staff || !me?.gym_id || me.gym_id !== them?.gym_id) throw new Error("Forbidden");
    }

    // --- Cache: one AI answer per (member, exercise set) per gym-local day ---
    const { timeZone } = await resolveGymTimezone(supabase, userId);
    const today = dateStringInZone(timeZone);
    const cacheKey = `v3:${today}:${[...data.exerciseIds].sort().join(",")}`;
    const { data: cached } = await supabase
      .from("ai_overload_cache")
      .select("payload")
      .eq("member_id", data.memberId)
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (cached?.payload) return cached.payload as unknown as ExerciseSuggestion[];

    // --- Per-user daily call ceiling, rolling over at the gym's midnight ---
    const dayStart = zonedDayStartISO(timeZone, today);
    const { count: callsToday } = await supabase
      .from("ai_overload_cache")
      .select("id", { count: "exact", head: true })
      .eq("requested_by", userId)
      .gte("created_at", dayStart);
    if ((callsToday ?? 0) >= DAILY_CALL_CEILING) {
      throw new Error("Daily AI suggestion limit reached — try again tomorrow.");
    }

    const since = new Date(Date.now() - FOUR_WEEKS_MS).toISOString();

    const [{ data: exRows }, { data: logs }] = await Promise.all([
      supabase.from("exercises").select("id, name, tracking").in("id", data.exerciseIds),
      supabase
        .from("exercise_logs")
        .select(
          "exercise_id, set_number, weight, reps, duration_seconds, completed, workout_logs!inner(member_id, date)",
        )
        .eq("workout_logs.member_id", data.memberId)
        .in("exercise_id", data.exerciseIds)
        .gte("workout_logs.date", since.slice(0, 10)),
    ]);

    const nameById = new Map<string, string>();
    const trackingById = new Map<string, string>();
    (exRows ?? []).forEach((r: any) => {
      nameById.set(r.id, r.name);
      trackingById.set(r.id, r.tracking ?? "weight_reps");
    });

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
        const w = Number(r.weight ?? 0),
          rp = Number(r.reps ?? 0);
        const cur = byDate.get(d);
        if (!cur || w * rp > cur.w * cur.r) byDate.set(d, { w, r: rp });
      }
      const history = Array.from(byDate.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .slice(-8)
        .map(([d, v]) => ({ date: d, weight: v.w, reps: v.r }));
      let best: { weight: number; reps: number; e: number } | null = null;
      for (const r of rows) {
        const w = Number(r.weight ?? 0);
        const rp = Number(r.reps ?? 0);
        if (w <= 0 || rp <= 0) continue;
        const e = w * (1 + rp / 30);
        if (!best || e > best.e) best = { weight: w, reps: rp, e };
      }
      const tracking = (trackingById.get(exId) ?? "weight_reps") as Tracking;
      const bestSeconds = rows.reduce(
        (m: number, r: any) => Math.max(m, Number(r.duration_seconds ?? 0)),
        0,
      );
      const bestReps = rows.reduce((m: number, r: any) => Math.max(m, Number(r.reps ?? 0)), 0);
      return {
        exerciseId: exId,
        exerciseName: nameById.get(exId) ?? "Exercise",
        tracking,
        bestSeconds: bestSeconds || null,
        bestReps: bestReps || null,
        sessionCount: rows.length ? Math.max(1, byDate.size) : 0,
        best: best ? { weight: best.weight, reps: best.reps } : null,
        avgWeight: avgW,
        avgReps: avgR,
        history,
      };
    });

    const logged = summaries.filter((s) => s.sessionCount >= 1);
    if (!logged.length) {
      throw new Error("Log at least one session in the last 4 weeks to get suggestions.");
    }

    const toSuggestion = (
      s: (typeof summaries)[number],
      ai?: { suggestedWeight?: number | null; suggestedReps?: number | null; reasoning?: string },
    ): ExerciseSuggestion => {
      const base = {
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        tracking: s.tracking,
        currentAvg: { weight: s.avgWeight, reps: s.avgReps, sets: s.sessionCount },
        currentBest: s.best,
        currentBestSeconds: s.bestSeconds,
        suggestedSeconds: null as number | null,
      };
      const rule = ruleTarget({
        name: s.exerciseName,
        tracking: s.tracking,
        best: s.best,
        bestReps: s.bestReps,
        bestSeconds: s.bestSeconds,
      });
      if (!rule) {
        return { ...base, suggestedWeight: null, suggestedReps: null, reasoning: "Log this once to get a target." };
      }
      // Accept the model's numbers only when they stay in a safe range and actually progress.
      if (ai && s.tracking === "weight_reps" && s.best) {
        const w = roundWeight(clampToDelta(ai.suggestedWeight, s.best.weight));
        const r = clampToDelta(ai.suggestedReps, s.best.reps, 0.25);
        const reps = r != null ? Math.round(r) : null;
        const progresses =
          w != null && reps != null && (w > s.best.weight || (w === s.best.weight && reps > s.best.reps));
        const text = cleanReasoning(ai.reasoning);
        if (progresses && text) {
          return { ...base, suggestedWeight: w, suggestedReps: reps, reasoning: text };
        }
      }
      return { ...base, ...rule };
    };

    let parsed: z.infer<typeof aiResponseSchema> | null = null;
    const aiCandidates = logged.filter((s) => s.tracking === "weight_reps" && s.best);
    if (aiCandidates.length) {
      const { chatCompletion } = await import("./ai-gateway.server");
      const prompt = `You are a strength coach. For each exercise, propose next week's target weight (kg) and reps.
Rules:
- Start from the best set. Never repeat the same weight and reps as the best set.
- If progressing, add about 2.5-5% weight (rounded to 2.5 kg) and reps may drop by one; otherwise keep weight and add 1 rep.
- With only one session, progress conservatively.
- reasoning: one short, friendly sentence for the member. No numbers in brackets, no jargon.
- Return ONLY valid JSON.

Data:
${JSON.stringify(aiCandidates.map((s) => ({ exerciseId: s.exerciseId, exerciseName: s.exerciseName, best: s.best, sessions: s.sessionCount, history: s.history })), null, 2)}

Return JSON:
{ "suggestions": [ { "exerciseId": "<uuid>", "suggestedWeight": <number>, "suggestedReps": <number>, "reasoning": "<sentence>" } ] }`;
      try {
        const text = await chatCompletion({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You return only valid JSON matching the requested schema." },
            { role: "user", content: prompt },
          ],
          responseFormat: "json_object",
        });
        parsed = aiResponseSchema.parse(JSON.parse(text));
      } catch (e: any) {
        // Technical detail stays in server logs; the user sees the rule-based target.
        console.error("[overload] AI suggestion failed, using rule-based targets:", e?.message ?? e);
      }
    }

    const map = new Map((parsed?.suggestions ?? []).map((x) => [x.exerciseId, x]));
    const result: ExerciseSuggestion[] = summaries.map((s) => toSuggestion(s, map.get(s.exerciseId)));

    // Cache so repeat views of the same day cost nothing.
    await supabase.from("ai_overload_cache").insert({
      requested_by: userId,
      member_id: data.memberId,
      cache_key: cacheKey,
      payload: result as any,
    });

    return result;
  });

/** Why suggestions can or can't be generated for a member right now. */
export const getOverloadReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const since = new Date(Date.now() - FOUR_WEEKS_MS).toISOString().slice(0, 10);
    const { count, error } = await context.supabase
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("member_id", data.memberId)
      .gte("date", since)
      .not("completed_at", "is", null);
    if (error) throw new Error(error.message);
    return { sessions: count ?? 0 };
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
          suggestedSeconds: z.number().nullable().optional(),
          reasoning: z.string().transform((v) => cleanReasoning(v) ?? ""),
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
      suggestion: {
        ...((data as any).suggestion ?? {}),
        reasoning: cleanReasoning((data as any).suggestion?.reasoning) ?? "",
      },
    };
  });
