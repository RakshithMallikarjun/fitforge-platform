import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily staff dues digest + nightly subscription expiry. Shared-secret guarded;
 * safe to call hourly — each gym is only served at 09:00 in its own timezone.
 */
export const Route = createFileRoute("/api/public/dues-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["NOTIFY_WEBHOOK_SECRET"];
        const provided = request.headers.get("x-webhook-secret") ?? "";
        if (!secret || provided.length !== secret.length || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = await request.json().catch(() => ({}) as any);
        const { runDuesDigest } = await import("@/lib/dues-digest.server");
        try {
          const results = await runDuesDigest({ force: !!body?.force, hour: body?.hour });
          return Response.json({ ok: true, results });
        } catch (e: any) {
          console.error("[dues-digest] run failed", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
