import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const num = z.number().finite().nullable().optional();

const assessmentInputSchema = z.object({
  member_id: z.string().uuid(),
  date: z.string(), // ISO date
  unit_system: z.enum(["metric", "imperial"]).default("metric"),
  weight: num,
  height: num,
  body_fat_pct: num,
  muscle_mass: num,
  chest: num,
  waist: num,
  hips: num,
  arms: num,
  thighs: num,
  vo2_max: num,
  resting_hr: num,
  blood_pressure: z.string().trim().max(20).nullable().optional(),
  flexibility: num,
  bench_1rm: num,
  squat_1rm: num,
  deadlift_1rm: num,
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type AssessmentInput = z.infer<typeof assessmentInputSchema>;

async function assertCanWrite(supabase: any, userId: string, memberId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const r = (roles ?? []).map((x: any) => x.role);
  if (r.includes("admin")) return;
  if (r.includes("trainer")) {
    const { data: assign } = await supabase
      .from("trainer_assignments")
      .select("id")
      .eq("trainer_id", userId)
      .eq("member_id", memberId)
      .eq("active", true)
      .maybeSingle();
    if (assign) return;
  }
  throw new Error("Forbidden");
}

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string }) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("fitness_assessments")
      .select("*")
      .eq("member_id", data.memberId)
      .order("date", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const createAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assessmentInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanWrite(supabase, userId, data.member_id);

    // Auto-calculate BMI from metric stored values
    let bmi: number | null = null;
    if (data.weight && data.height && data.height > 0) {
      const heightM = data.height / 100;
      bmi = Number((data.weight / (heightM * heightM)).toFixed(2));
    }

    const { data: memberRow } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", data.member_id)
      .maybeSingle();
    if (!memberRow?.gym_id) throw new Error("Member gym not found");

    const { data: inserted, error } = await supabase
      .from("fitness_assessments")
      .insert({
        member_id: data.member_id,
        gym_id: memberRow.gym_id,
        trainer_id: userId,
        date: data.date,
        unit_system: data.unit_system,
        weight: data.weight ?? null,
        height: data.height ?? null,
        bmi,
        body_fat_pct: data.body_fat_pct ?? null,
        muscle_mass: data.muscle_mass ?? null,
        chest: data.chest ?? null,
        waist: data.waist ?? null,
        hips: data.hips ?? null,
        arms: data.arms ?? null,
        thighs: data.thighs ?? null,
        vo2_max: data.vo2_max ?? null,
        resting_hr: data.resting_hr ?? null,
        blood_pressure: data.blood_pressure ?? null,
        flexibility: data.flexibility ?? null,
        bench_1rm: data.bench_1rm ?? null,
        squat_1rm: data.squat_1rm ?? null,
        deadlift_1rm: data.deadlift_1rm ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  });

export const deleteAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("fitness_assessments")
      .select("member_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    await assertCanWrite(supabase, userId, row.member_id);
    const { error } = await supabase.from("fitness_assessments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
