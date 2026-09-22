/**
 * Single source of truth for Supabase auth redirect URLs.
 *
 * Every auth email / OAuth round-trip must come back to the SAME origin the
 * user started on, so a member on `gymname.fitfoundry.in` is never bounced to
 * the root domain or, worse, another gym's subdomain. Browsers give us that for
 * free via `window.location.origin`, which also keeps localhost and Lovable
 * preview hosts working in development.
 */

import { PLATFORM_DOMAIN, PLATFORM_URL } from "./platform-brand";

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/** Absolute URL on the current origin (falls back to the platform root). */
export function getAuthRedirectUrl(path: string): string {
  const p = normalizePath(path);
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${p}`;
  }
  return `${PLATFORM_URL}${p}`;
}

/**
 * Server-side variant for invite / notification emails, where there is no
 * browser origin: prefer the gym's custom domain, else `{slug}.fitfoundry.in`.
 */
export function getGymAuthRedirectUrl(
  gym: { slug?: string | null; custom_domain?: string | null },
  path: string,
): string {
  const p = normalizePath(path);
  const custom = gym.custom_domain?.trim();
  if (custom) {
    const host = custom.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (host) return `https://${host}${p}`;
  }
  const slug = gym.slug?.trim();
  if (slug) return `https://${slug}.${PLATFORM_DOMAIN}${p}`;
  return `${PLATFORM_URL}${p}`;
}
