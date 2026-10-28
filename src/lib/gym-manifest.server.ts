import { isHostingHost } from "@/lib/public-config";
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

export function hostKey(host: string | null): { slug?: string; domain?: string } {
  if (!host) return {};
  const h = host.split(":")[0].toLowerCase();
  if (
    h === "localhost" ||
    isHostingHost(h) ||
    h === PLATFORM_DOMAIN ||
    h === `www.${PLATFORM_DOMAIN}`
  )
    return {};
  if (h.endsWith(`.${PLATFORM_DOMAIN}`)) return { slug: h.slice(0, -PLATFORM_DOMAIN.length - 1) };
  return { domain: h };
}

export async function resolveGym(key: { slug?: string; domain?: string }) {
  if (!key.slug && !key.domain) return null;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return null;
  try {
    const supabase = createClient<Database>(url, anon, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: anon.startsWith("sb_")
        ? {
            // Opaque publishable keys are not JWTs: send apikey only, no Bearer.
            fetch: (input: RequestInfo | URL, init?: RequestInit) => {
              const headers = new Headers(init?.headers);
              if (headers.get("Authorization") === `Bearer ${anon}`) headers.delete("Authorization");
              headers.set("apikey", anon);
              return fetch(input, { ...init, headers });
            },
          }
        : undefined,
    });
    const { data } = await supabase.rpc("public_gym_manifest", {
      _slug: key.slug ?? (null as any),
      _domain: key.domain ?? (null as any),
    });
    return (data ?? [])[0] ?? null;
  } catch {
    return null;
  }
}


/** Build a manifest for a gym (or the Fit Foundry default when gym is null). */
export function buildManifest(gym: { name?: string | null; primary_color?: string | null; logo_url?: string | null } | null) {
  const name = gym?.name?.trim() || PLATFORM_NAME;
  const logo = gym?.logo_url ?? undefined;
  const icons = logo
    ? [
        { src: logo, sizes: "192x192", purpose: "any" },
        { src: logo, sizes: "512x512", purpose: "any" },
        { src: logo, sizes: "512x512", purpose: "maskable" },
        ...FALLBACK_ICONS,
      ]
    : FALLBACK_ICONS;
  return {
    name,
    short_name: shortName(name),
    description: DEFAULTS.description,
    theme_color: gym?.primary_color || DEFAULTS.theme_color,
    background_color: DEFAULTS.background_color,
    display: "standalone",
    orientation: "portrait",
    scope: "/",
    start_url: "/app",
    id: "/app",
    icons,
  };
}

export function manifestResponse(manifest: unknown) {
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
