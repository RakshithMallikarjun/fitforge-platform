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

function esc(s: any): string {
  if (s == null || s === "") return "—";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function trend(curr: number | null | undefined, prev: number | null | undefined): string {
  if (curr == null || prev == null) return "";
  if (curr > prev) return ' <span style="color:#059669">↑</span>';
  if (curr < prev) return ' <span style="color:#dc2626">↓</span>';
  return ' <span style="color:#6b7280">→</span>';
}

export const exportAssessmentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string }) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanWrite(supabase, userId, data.memberId);

    const { data: member } = await supabase
      .from("users")
      .select("display_name, email, gym_id")
      .eq("id", data.memberId)
      .maybeSingle();
    const memberName = (member as any)?.display_name || (member as any)?.email || "Member";

    let gymName = "";
    if ((member as any)?.gym_id) {
      const { data: gym } = await supabase.from("gyms").select("name").eq("id", (member as any).gym_id).maybeSingle();
      gymName = (gym as any)?.name || "";
    }

    const { data: rows } = await supabase
      .from("fitness_assessments")
      .select("*")
      .eq("member_id", data.memberId)
      .order("date", { ascending: true });

    const assessments = rows ?? [];

    const metrics: [string, string, string?][] = [
      ["Weight", "weight", "kg"],
      ["Height", "height", "cm"],
      ["BMI", "bmi"],
      ["Body fat %", "body_fat_pct", "%"],
      ["Muscle mass", "muscle_mass", "kg"],
      ["Chest", "chest", "cm"],
      ["Waist", "waist", "cm"],
      ["Hips", "hips", "cm"],
      ["Arms", "arms", "cm"],
      ["Thighs", "thighs", "cm"],
      ["VO2 max", "vo2_max"],
      ["Resting HR", "resting_hr", "bpm"],
      ["Blood pressure", "blood_pressure"],
      ["Flexibility", "flexibility", "cm"],
      ["Bench 1RM", "bench_1rm", "kg"],
      ["Squat 1RM", "squat_1rm", "kg"],
      ["Deadlift 1RM", "deadlift_1rm", "kg"],
    ];

    const headerCells = assessments.map((a: any) => `<th>${esc(new Date(a.date).toLocaleDateString())}</th>`).join("");

    const rowsHtml = metrics.map(([label, key, suffix]) => {
      const cells = assessments.map((a: any, i: number) => {
        const v = a[key];
        const prev = i > 0 ? assessments[i - 1][key] : null;
        const display = v == null || v === "" ? "—" : `${typeof v === "number" ? Number(v).toFixed(1) : esc(v)}${suffix ? " " + suffix : ""}`;
        const t = typeof v === "number" && typeof prev === "number" ? trend(v, prev) : "";
        return `<td>${display}${t}</td>`;
      }).join("");
      return `<tr><th style="text-align:left;background:#f9fafb">${esc(label)}</th>${cells}</tr>`;
    }).join("");

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Assessment Report — ${esc(memberName)}</title>
<style>
  @page { size: A4 landscape; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; background: #fff; margin: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  thead th { background: #f3f4f6; font-weight: 600; }
  .actions { margin-bottom: 16px; }
  .actions button { padding: 8px 14px; border: 1px solid #111; background: #111; color: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; }
  @media print { .actions { display: none; } body { margin: 0; } }
</style></head>
<body>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>${esc(gymName ? gymName + " — " : "")}Assessment Report</h1>
  <div class="sub">${esc(memberName)} · Generated ${esc(new Date().toLocaleDateString())} · ${assessments.length} assessment${assessments.length === 1 ? "" : "s"}</div>
  ${assessments.length === 0
    ? '<p style="color:#6b7280">No assessments recorded.</p>'
    : `<table><thead><tr><th style="text-align:left">Metric</th>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table>`}
  <script>window.addEventListener("message",function(e){if(e.data==="print")window.print();});</script>
</body></html>`;

    return { html, memberName };
  });
