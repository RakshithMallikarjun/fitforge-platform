/** Runs a scheduled job and records the run in scheduled_job_runs (service role). */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDailySummary } from "@/lib/daily-summary.server";
import { runDuesDigest } from "@/lib/dues-digest.server";

export type JobName = "daily_summary" | "dues_digest";

export async function trackJob(
  job: JobName,
  opts: { gymId?: string; manual?: boolean; origin?: string },
) {
  const { data: row } = await supabaseAdmin.from("scheduled_job_runs").insert({ job }).select("id").single();
  let results: any[] = [];
  let error: string | null = null;
  try {
    results =
      job === "daily_summary"
        ? await runDailySummary({ gymId: opts.gymId, force: opts.manual, duesBaseUrl: opts.origin })
        : await runDuesDigest({ gymId: opts.gymId, ignoreHour: opts.manual });
  } catch (e: any) {
    error = e?.message ?? String(e);
    console.error(`[scheduled-jobs] ${job}`, e);
  }
  const failures = results
    .filter((r) => typeof r.reason === "string" && r.reason.includes("failed"))
    .map((r) => `${r.gym_name}: ${r.reason}`);
  if (row) {
    await supabaseAdmin
      .from("scheduled_job_runs")
      .update({
        finished_at: new Date().toISOString(),
        gyms_processed: results.filter((r) => r.reason !== "not_this_hour").length,
        sent_count: results.filter((r) => r.outcome === "sent" || r.outcome === "pushed").length,
        error: error ?? (failures.length ? failures.join("; ") : null),
        results: { manual: !!opts.manual, items: results } as any,
      })
      .eq("id", row.id);
  }
  return { job, error, results };
}
