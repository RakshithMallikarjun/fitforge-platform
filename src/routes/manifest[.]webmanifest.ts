import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PLATFORM_DOMAIN, PLATFORM_NAME } from "@/lib/platform-brand";

const DEFAULTS = {
  description: "Your gym in your pocket — workouts, plans, and progress.",
  theme_color: "#059669",
  background_color: "#F8FAFC",
};

const FALLBACK_ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** Home-screen labels get cut off past ~12 characters. */
export function shortName(name: string) {
  const n = name.trim();
  return n.length <= 12 ? n : n.slice(0, 12).trimEnd();
}

function hostKey(host: string | null): { slug?: string; domain?: string } {
  if (!host) return {};
  const h = host.split(":")[0].toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") ||
    h === PLATFORM_DOMAIN ||
    h === `www.${PLATFORM_DOMAIN}`
  )
    return {};
  if (h.endsWith(`.${PLATFORM_DOMAIN}`)) return { slug: h.slice(0, -PLATFORM_DOMAIN.length - 1) };
  return { domain: h };
}

async function resolveGym(key: { slug?: string; domain?: string }) {
  if (!key.slug && !key.domain) return null;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return null;
  try {
    const supabase = createClient<Database>(url, anon, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: anon.startsWith("sb_") ? { headers: { apikey: anon } } : undefined,
    });
    let q = supabase.from("gyms").select("name, primary_color, logo_url").limit(1);
    q = key.slug ? q.eq("slug", key.slug) : q.eq("custom_domain", key.domain!);
    const { data } = await q.maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const qSlug = url.searchParams.get("gym")?.toLowerCase().replace(/[^a-z0-9-]/g, "");
        const key = qSlug ? { slug: qSlug } : hostKey(request.headers.get("host"));
        const gym = await resolveGym(key);

        const name = gym?.name?.trim() || PLATFORM_NAME;
        const logo = (gym as any)?.logo_url as string | undefined;
        const icons = logo
          ? [
              { src: logo, sizes: "192x192", purpose: "any" },
              { src: logo, sizes: "512x512", purpose: "any" },
              { src: logo, sizes: "512x512", purpose: "maskable" },
              ...FALLBACK_ICONS,
            ]
          : FALLBACK_ICONS;

        const manifest = {
          name,
          short_name: shortName(name),
          description: DEFAULTS.description,
          theme_color: (gym as any)?.primary_color || DEFAULTS.theme_color,
          background_color: DEFAULTS.background_color,
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/app",
          id: gym ? `/app?gym=${encodeURIComponent(qSlug ?? key.slug ?? key.domain ?? "")}` : "/app",
          icons,
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
