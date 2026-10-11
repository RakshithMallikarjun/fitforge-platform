import { createFileRoute } from "@tanstack/react-router";
import { buildManifest, manifestResponse, resolveGym } from "@/lib/gym-manifest.server";

/** Public per-gym manifest: /manifest/<gym-code>.webmanifest (no sign-in needed). */
export const Route = createFileRoute("/manifest/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const m = /^([a-z0-9-]{1,64})\.webmanifest$/i.exec(params.file);
        if (!m) return new Response("Not found", { status: 404 });
        return manifestResponse(buildManifest(await resolveGym({ slug: m[1].toLowerCase() })));
      },
    },
  },
});
