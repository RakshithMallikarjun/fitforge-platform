/**
 * Public, user-visible addresses. Everything a gym admin or member sees, and
 * every link put into an email, QR code or share message, is built from here —
 * never from the browser origin or the hosting provider's address.
 */

function readEnv(name: string): string | undefined {
  const viteEnv = (typeof import.meta !== "undefined" && (import.meta as any).env) || {};
  const v =
    (viteEnv[`VITE_${name}`] as string | undefined) ??
    (typeof process !== "undefined" ? process.env?.[name] : undefined);
  return v?.trim() || undefined;
}

const cleanHost = (v: string) =>
  v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");

export const PUBLIC_APP_URL: string = (readEnv("PUBLIC_APP_URL") ?? "https://fitfoundry.in").replace(/\/+$/, "");
export const PUBLIC_APP_HOST: string = cleanHost(readEnv("PUBLIC_APP_HOST") ?? new URL(PUBLIC_APP_URL).host);
/** Branded target gyms point their custom domain's CNAME to. */
export const CUSTOM_DOMAIN_CNAME_TARGET: string = cleanHost(
  readEnv("CUSTOM_DOMAIN_CNAME_TARGET") ?? `custom.${PUBLIC_APP_HOST}`,
);

/** Internal hosting/preview host suffixes (config only — never shown to users). */
const HOSTING_SUFFIXES = [".lovable.app", ".lovable.dev", ".lovableproject.com", ".lovableproject-dev.com"];

export function isHostingHost(host: string): boolean {
  const h = cleanHost(host).split(":")[0];
  return HOSTING_SUFFIXES.some((s) => h === s.slice(1) || h.endsWith(s));
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/** Public link for a gym: its active custom domain, else the platform URL. */
export function publicGymUrl(path = "/", activeCustomDomain?: string | null): string {
  const host = activeCustomDomain ? cleanHost(activeCustomDomain) : "";
  const base = host && !isHostingHost(host) ? `https://${host}` : PUBLIC_APP_URL;
  return `${base}${normalizePath(path)}`;
}

const RESERVED_GYM_SLUGS = new Set(["www", "app", "api", "auth", "admin", "platform", "custom", "cdn", "videos", "support", "mail"]);

export function isGymSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug) && !RESERVED_GYM_SLUGS.has(slug);
}

export function gymSlugFromHost(host: string): string | null {
  const hostname = cleanHost(host).split(":")[0];
  const suffix = `.${PUBLIC_APP_HOST}`;
  if (!hostname.endsWith(suffix)) return null;
  const slug = hostname.slice(0, -suffix.length);
  return isGymSlug(slug) ? slug : null;
}

/** Tenant addresses derive from the stored gym slug, never a submitted external domain. */
export function gymSiteUrl(slug: string, path = "/"): string {
  if (!isGymSlug(slug)) throw new Error("This gym needs a valid, non-reserved address code.");
  return `https://${slug}.${PUBLIC_APP_HOST}${normalizePath(path)}`;
}

export function gymHostDecision(host: string, accountSlug: string | null): "stay" | "forward" | "reject" {
  const tenant = gymSlugFromHost(host);
  if (tenant) return tenant === accountSlug ? "stay" : "reject";
  const hostname = cleanHost(host).split(":")[0];
  return (hostname === PUBLIC_APP_HOST || hostname === `www.${PUBLIC_APP_HOST}`) && accountSlug
    ? "forward" : "stay";
}

/** Returns a friendly error, or null when the custom domain is acceptable. */
export function validateCustomDomain(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^[a-z]+:\/\//i.test(v)) return "Leave out http:// or https:// — enter just the domain, like app.yourgym.com.";
  if (/[/?#]/.test(v)) return "Enter just the domain, without any path — like app.yourgym.com.";
  if (v !== v.toLowerCase()) return "Use lowercase letters only.";
  if (v.length > 253 || !/^(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/.test(v))
    return "That isn't a valid domain. Use something like app.yourgym.com.";
  if (v === PUBLIC_APP_HOST || v.endsWith(`.${PUBLIC_APP_HOST}`) || v === `www.${PUBLIC_APP_HOST}`)
    return "Use a domain your gym owns, not the Fit Foundry address.";
  if (isHostingHost(v)) return "That address can't be used. Enter a domain your gym owns, like app.yourgym.com.";
  return null;
}
