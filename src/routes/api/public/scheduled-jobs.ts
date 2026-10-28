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
        const { trackJob } = await import("@/lib/scheduled-jobs.server");
        const out = [
          await trackJob("daily_summary", {}),
          await trackJob("dues_digest", {}),
        ].map((o) => ({ job: o.job, error: o.error, results: o.results.length }));
        return Response.json({ ok: out.every((o) => !o.error), out });
      },
    },
  },
});
