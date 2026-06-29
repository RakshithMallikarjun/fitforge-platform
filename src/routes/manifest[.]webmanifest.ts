import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const DEFAULTS = {
  name: "FitForge — Member",
  short_name: "FitForge",
  description: "Your gym in your pocket — workouts, plans, and progress.",
  theme_color: "#059669",
  background_color: "#F8FAFC",
};

function slugFromHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.split(":")[0].toLowerCase();
  // ignore local, preview, and apex lovable domains
  if (
    h === "localhost" ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com")
  ) {
    return null;
  }
  const parts = h.split(".");
  // subdomain.gym.com -> "subdomain"
  if (parts.length >= 3) return parts[0];
  return null;
}

async function resolveGymTheme(host: string | null) {
  const slug = slugFromHost(host);
  if (!slug) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const supabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase
      .from("gyms")
      .select("name, primary_color, logo_url")
      .eq("slug", slug)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = request.headers.get("host");
        const gym = await resolveGymTheme(host);

        const name = gym?.name ?? DEFAULTS.name;
        const themeColor = (gym as any)?.primary_color ?? DEFAULTS.theme_color;
        const icon = (gym as any)?.logo_url as string | undefined;

        const manifest = {
          name: `${name} — Member`,
          short_name: name,
          description: DEFAULTS.description,
          theme_color: themeColor,
          background_color: DEFAULTS.background_color,
          display: "standalone",
          orientation: "portrait",
          scope: "/app",
          start_url: "/app",
          id: "/app",
          icons: icon
            ? [
                { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
                { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
              ]
            : [
                { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
                { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
                { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              ],
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
