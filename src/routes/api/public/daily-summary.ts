import { createFileRoute } from "@tanstack/react-router";

/**
 * Hourly end-of-day summary sweep. Call from pg_cron (or any scheduler) with
 * the shared secret; each run handles every gym whose local hour matches its
 * configured daily_summary_hour, so all timezones are served by one job.
 */
export const Route = createFileRoute("/api/public/daily-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["NOTIFY_WEBHOOK_SECRET"];
        const provided = request.headers.get("x-webhook-secret") ?? "";
        if (!secret || provided.length !== secret.length || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = await request.json().catch(() => ({}) as any);
        const { runDailySummary } = await import("@/lib/daily-summary.server");
        try {
          const results = await runDailySummary({
            gymId: body?.gym_id,
            force: !!body?.force,
            duesBaseUrl: new URL(request.url).origin,
          });
          return Response.json({ ok: true, results });
        } catch (e: any) {
          console.error("[daily-summary] run failed", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
