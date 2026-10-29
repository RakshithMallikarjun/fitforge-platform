/**
 * Single source of truth for Supabase auth redirect URLs.
 *
 * Every auth email / OAuth round-trip must come back to the SAME origin the
 * user started on, so a member on `gymname.fitfoundry.in` is never bounced to
 * the root domain or, worse, another gym's subdomain. Browsers give us that for
 * free via the current host; local dev and previews keep their own origins.
 */

import { PUBLIC_APP_URL, gymLoginUrl } from "./public-config";

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/** Absolute URL on the current origin (falls back to the platform root). */
export function getAuthRedirectUrl(path: string): string {
  const p = normalizePath(path);
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.origin}${p}`;
  }
  return `${PUBLIC_APP_URL}${p}`;
}

/** Server-side variant for emails: root today; the gym subdomain once activated. */
export function getGymAuthRedirectUrl(gym: { slug: string }, path: string): string {
  return gymLoginUrl(gym.slug, normalizePath(path));
}
