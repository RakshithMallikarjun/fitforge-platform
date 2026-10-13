import { createFileRoute } from "@tanstack/react-router";

/**
 * Every-15-minutes scheduler entry point (pg_cron + pg_net). Runs the daily
 * collection email and the dues digest/auto-reminders; each job is idempotent
 * per gym per local day, and every run is recorded in scheduled_job_runs.
 */
export const Route = createFileRoute("/api/public/scheduled-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Accept the env secret (manual callers) or the database-held scheduler token (pg_cron).
        const provided = request.headers.get("x-webhook-secret") ?? "";
        const envSecret = process.env["NOTIFY_WEBHOOK_SECRET"] ?? "";
        const { data: cfg } = await supabaseAdmin.from("scheduler_config").select("token").maybeSingle();
        const ok = (v: string) => !!v && v.length === provided.length && v === provided;
        if (!provided || !(ok(envSecret) || ok((cfg as any)?.token ?? ""))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runDailySummary } = await import("@/lib/daily-summary.server");
        const { runDuesDigest } = await import("@/lib/dues-digest.server");
        const origin = new URL(request.url).origin;

        async function track(job: string, fn: () => Promise<any[]>, sentOf: (r: any) => boolean) {
          const { data: row } = await supabaseAdmin
            .from("scheduled_job_runs")
            .insert({ job })
            .select("id")
            .single();
          let results: any[] = [];
          let error: string | null = null;
          try {
            results = await fn();
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
                sent_count: results.filter(sentOf).length,
                error: error ?? (failures.length ? failures.join("; ") : null),
                results,
              })
              .eq("id", row.id);
          }
          return { job, error, results: results.length };
        }

        const out = [
          await track(
            "daily_summary",
            () => runDailySummary({ duesBaseUrl: origin }),
            (r) => r.outcome === "sent",
          ),
          await track("dues_digest", () => runDuesDigest({}), (r) => r.outcome === "pushed"),
        ];
        return Response.json({ ok: out.every((o) => !o.error), out });
      },
    },
  },
});
