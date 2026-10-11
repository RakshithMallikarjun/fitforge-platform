import { createFileRoute } from "@tanstack/react-router";
import { buildManifest, hostKey, manifestResponse, resolveGym } from "@/lib/gym-manifest.server";

/** Fit Foundry manifest; a gym's custom domain (or ?gym=) gets that gym's branding. */
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const qSlug = url.searchParams.get("gym")?.toLowerCase().replace(/[^a-z0-9-]/g, "");
        const key = qSlug ? { slug: qSlug } : hostKey(request.headers.get("host"));
        return manifestResponse(buildManifest(await resolveGym(key)));
      },
    },
  },
});
