/**
 * AI-assisted plan drafting.
 *
 * A trainer records the member's goals, limitations and available equipment; the
 * model then proposes a full week of training that is returned as a *draft only*
 * — nothing is written to the member's plan until the trainer saves in the
 * builder. Only exercises that already exist in the gym's library can appear.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion } from "@/lib/ai-gateway.server";
import { dateStringInZone, resolveGymTimezone } from "@/lib/gym-date";

/** Per-gym ceiling on generations in a single gym-local day. */
const DAILY_GENERATION_CAP = 30;
const MAX_CATALOG = 160;

export type TrainingProfile = {
  member_id: string;
  goals: string;
  limitations: string;
  equipment: string[];
  days_per_week: number;
  session_minutes: number;
  experience: "beginner" | "intermediate" | "advanced";
  updated_at: string | null;
};

export type DraftExercise = {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
};

export type DraftDay = {
  day_label: string;
  block_type: "warmup" | "main" | "cooldown";
  exercises: DraftExercise[];
};

export type PlanDraft = {
  plan_name: string;
  notes: string;
  days: DraftDay[];
  skipped: string[];
};

const profileInput = z.object({
  memberId: z.string().uuid(),
  goals: z.string().trim().min(3).max(1000),
  limitations: z.string().trim().max(1000).default(""),
  equipment: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionMinutes: z.number().int().min(15).max(180),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
});

/** Model replies are untrusted input — every field is validated and clamped. */
const aiDraftSchema = z.object({
  plan_name: z.string().max(80).optional(),
  notes: z.string().max(600).optional(),
  days: z
    .array(
      z.object({
        day_label: z.string().max(40).optional(),
        block_type: z.enum(["warmup", "main", "cooldown"]).optional(),
        exercises: z
          .array(
            z.object({
              name: z.string().min(1).max(120),
              sets: z.number().finite().optional().nullable(),
              reps: z
                .union([z.string().max(20), z.number()])
                .optional()
                .nullable(),
              rest_seconds: z.number().finite().optional().nullable(),
              notes: z.string().max(200).optional().nullable(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

type Ctx = { supabase: any; userId: string };

/** Caller must be staff in the member's gym (or the member reading their own row). */
async function resolveAccess(
  { supabase, userId }: Ctx,
  memberId: string,
  opts: { staffOnly: boolean },
) {
  const [{ data: me }, { data: roles }] = await Promise.all([
    supabase.from("users").select("gym_id").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const r = (roles ?? []).map((x: any) => x.role as string);
  const isStaff = r.includes("admin") || r.includes("trainer");
  const gymId = (me as any)?.gym_id as string | null;
  if (!gymId) throw new Error("No gym");

  if (!isStaff) {
    if (opts.staffOnly || memberId !== userId) throw new Error("Forbidden");
    return { gymId, isStaff };
  }

  const { data: target } = await supabase
    .from("users")
    .select("gym_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!target || (target as any).gym_id !== gymId) throw new Error("Member not found in your gym");
  return { gymId, isStaff };
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const getTrainingProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ memberId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<TrainingProfile | null> => {
    const { supabase, userId } = context;
    await resolveAccess({ supabase, userId }, data.memberId, { staffOnly: false });
    const { data: row, error } = await supabase
      .from("member_training_profiles")
      .select(
        "member_id, goals, limitations, equipment, days_per_week, session_minutes, experience, updated_at",
      )
      .eq("member_id", data.memberId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as TrainingProfile | null) ?? null;
  });

export const saveTrainingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileInput.parse(data))
  .handler(async ({ context, data }): Promise<TrainingProfile> => {
    const { supabase, userId } = context;
    const { gymId } = await resolveAccess({ supabase, userId }, data.memberId, { staffOnly: true });
    const { data: row, error } = await supabase
      .from("member_training_profiles")
      .upsert(
        {
          member_id: data.memberId,
          gym_id: gymId,
          goals: data.goals,
          limitations: data.limitations,
          equipment: data.equipment,
          days_per_week: data.daysPerWeek,
          session_minutes: data.sessionMinutes,
          experience: data.experience,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      )
      .select(
        "member_id, goals, limitations, equipment, days_per_week, session_minutes, experience, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return row as TrainingProfile;
  });

/** Distinct equipment values used by the gym's own exercise library. */
export const listGymEquipment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.from("exercises").select("equipment");
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const r of rows ?? []) {
      for (const e of ((r as any).equipment ?? []) as string[]) {
        const v = e?.trim();
        if (v) set.add(v);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });

export const generatePlanDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileInput.parse(data))
  .handler(async ({ context, data }): Promise<PlanDraft> => {
    const { supabase, userId } = context;
    const { gymId } = await resolveAccess({ supabase, userId }, data.memberId, { staffOnly: true });

    // --- Daily cap, counted on the gym's own calendar day ---
    const { timeZone } = await resolveGymTimezone(supabase, userId);
    const gymDay = dateStringInZone(timeZone);
    const { count } = await supabase
      .from("ai_plan_generations")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("gym_day", gymDay);
    if ((count ?? 0) >= DAILY_GENERATION_CAP) {
      throw new Error("Daily AI plan limit reached for your gym. Try again tomorrow.");
    }

    // --- Candidate exercises: the gym's own library only ---
    let q = supabase
      .from("exercises")
      .select("id, name, equipment, muscle_groups, difficulty")
      .order("name", { ascending: true })
      .limit(MAX_CATALOG);
    if (data.equipment.length) q = q.overlaps("equipment", data.equipment);
    const first = await q;
    if (first.error) throw new Error(first.error.message);
    let catalog = first.data;
    // Equipment filter can be too narrow (e.g. bodyweight work stored with no
    // equipment at all) — fall back to the full library rather than fail.
    if (!catalog?.length && data.equipment.length) {
      const { data: all, error: allErr } = await supabase
        .from("exercises")
        .select("id, name, equipment, muscle_groups, difficulty")
        .order("name", { ascending: true })
        .limit(MAX_CATALOG);
      if (allErr) throw new Error(allErr.message);
      catalog = all;
    }
    if (!catalog?.length) {
      throw new Error("Add exercises to your library before generating a plan.");
    }

    const byName = new Map<string, { id: string; name: string }>();
    for (const e of catalog as any[]) byName.set(normalize(e.name), { id: e.id, name: e.name });

    const catalogLines = (catalog as any[])
      .map(
        (e) =>
          `- ${e.name} | equipment: ${(e.equipment ?? []).join(", ") || "none"} | muscles: ${(e.muscle_groups ?? []).join(", ") || "n/a"}`,
      )
      .join("\n");

    const system = [
      "You are an experienced strength & conditioning coach writing a weekly training plan.",
      "You MUST only use exercises from the provided library, copying each name EXACTLY.",
      "Respect the athlete's limitations strictly: never include a movement that aggravates them.",
      "Return JSON only, shaped as:",
      '{"plan_name":string,"notes":string,"days":[{"day_label":string,"block_type":"warmup"|"main"|"cooldown","exercises":[{"name":string,"sets":number,"reps":string,"rest_seconds":number,"notes":string}]}]}',
      "Produce exactly the requested number of training days, each with 4-7 exercises that fit the session length.",
    ].join("\n");

    const user = [
      `Goals: ${data.goals}`,
      `Limitations / injuries: ${data.limitations || "none reported"}`,
      `Available equipment: ${data.equipment.join(", ") || "whatever the library allows"}`,
      `Training days per week: ${data.daysPerWeek}`,
      `Session length: ${data.sessionMinutes} minutes`,
      `Experience level: ${data.experience}`,
      "",
      "Exercise library:",
      catalogLines,
    ].join("\n");

    const raw = await chatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      responseFormat: "json_object",
      temperature: 0.4,
    });

    let parsed: z.infer<typeof aiDraftSchema>;
    try {
      parsed = aiDraftSchema.parse(JSON.parse(raw));
    } catch {
      throw new Error("The AI reply could not be read. Please try generating again.");
    }

    const skipped: string[] = [];
    const days: DraftDay[] = [];
    for (const [i, d] of parsed.days.slice(0, 7).entries()) {
      const exercises: DraftExercise[] = [];
      for (const e of d.exercises.slice(0, 12)) {
        const match = byName.get(normalize(e.name));
        if (!match) {
          skipped.push(e.name);
          continue;
        }
        exercises.push({
          exercise_id: match.id,
          exercise_name: match.name,
          sets: Math.min(10, Math.max(1, Math.round(Number(e.sets) || 3))),
          reps: String(e.reps ?? "8-12").slice(0, 20),
          rest_seconds: Math.min(600, Math.max(15, Math.round(Number(e.rest_seconds) || 90))),
          notes: (e.notes ?? "").slice(0, 200),
        });
      }
      if (!exercises.length) continue;
      days.push({
        day_label: (d.day_label || `Day ${i + 1}`).slice(0, 40),
        block_type: d.block_type ?? "main",
        exercises,
      });
    }

    if (!days.length) {
      throw new Error("The AI could not match any exercises in your library. Please try again.");
    }

    // Audit + cap counter. Never block the draft on a logging failure.
    const { error: logErr } = await supabase.from("ai_plan_generations").insert({
      gym_id: gymId,
      member_id: data.memberId,
      created_by: userId,
      gym_day: gymDay,
    });
    if (logErr) console.error("[plan-ai] generation log failed", logErr.message);

    return {
      plan_name: (parsed.plan_name || "AI plan").slice(0, 80),
      notes: (parsed.notes || "").slice(0, 600),
      days,
      skipped: [...new Set(skipped)].slice(0, 10),
    };
  });
