/**
 * Single source of truth for Supabase auth redirect URLs.
 *
 * Every auth email / OAuth round-trip must come back to the SAME origin the
 * user started on, so a member on `gymname.fitfoundry.in` is never bounced to
 * the root domain or, worse, another gym's subdomain. Browsers give us that for
 * free via the current host; local dev keeps its origin and internal hosting
 * hosts fall back to the public brand URL.
 */

import { isHostingHost, PUBLIC_APP_URL, publicGymUrl } from "./public-config";

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/** Absolute URL on the current origin (falls back to the platform root). */
export function getAuthRedirectUrl(path: string): string {
  const p = normalizePath(path);
  if (typeof window !== "undefined" && window.location?.hostname) {
    const h = window.location.hostname;
    // Local dev keeps its own origin; hosting/preview hosts use the brand URL;
    // the brand domain and gym custom domains return to where the user started.
    if (h === "localhost" || h === "127.0.0.1") return `${window.location.origin}${p}`;
    if (!isHostingHost(h)) return `https://${window.location.host}${p}`;
  }
  return `${PUBLIC_APP_URL}${p}`;
}

/** Server-side variant for emails: the gym's active custom domain, else the brand URL. */
export function getGymAuthRedirectUrl(
  gym: { custom_domain?: string | null },
  path: string,
): string {
  return publicGymUrl(normalizePath(path), gym.custom_domain);
}
