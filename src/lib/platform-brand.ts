/**
 * Single source of truth for the platform brand (NOT per-gym white-label branding).
 *
 * Gym-level name/logo/colors/slug still come from the database — only the
 * platform-level brand and domains live here.
 */

export const PLATFORM_NAME = "Fit Foundry";
/** Identifier-safe form used for storage keys, ids and sync tags. */
export const PLATFORM_SLUG = "fitfoundry";
export const PLATFORM_DOMAIN = "fitfoundry.in";
export const PLATFORM_URL = `https://${PLATFORM_DOMAIN}`;
export const SUPPORT_EMAIL = `support@${PLATFORM_DOMAIN}`;
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  `${PLATFORM_NAME} Support Request`,
)}`;
export const ASSET_BASE_URL = `https://cdn.${PLATFORM_DOMAIN}`;
export const VIDEO_BASE_URL = `https://videos.${PLATFORM_DOMAIN}`;
export const DEMO_URL = `https://demo.${PLATFORM_DOMAIN}`;

/** Background-sync tag for the offline workout queue. */
export const SYNC_TAG = `${PLATFORM_SLUG}-log-sync`;
/** Previous tag, kept so queued logs from installed apps are not lost. */
export const LEGACY_SYNC_TAG = "fitforge-log-sync";

/** `{slug}.fitfoundry.in` preview shown in gym settings and the new-gym dialog. */
export function gymSubdomain(slug: string) {
  return `${slug}.${PLATFORM_DOMAIN}`;
}

const LEGACY_PREFIX = "fitforge";

/**
 * One-time copy of any legacy `fitforge*` browser-storage value to its
 * `fitfoundry*` equivalent, then delete the old key. Keeps dismissed banners,
 * ad frequency caps and other preferences intact across the rebrand.
 */
export function migrateLegacyStorageKeys() {
  if (typeof window === "undefined") return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(LEGACY_PREFIX)) keys.push(k);
      }
      for (const oldKey of keys) {
        const newKey = PLATFORM_SLUG + oldKey.slice(LEGACY_PREFIX.length);
        const value = store.getItem(oldKey);
        if (value !== null && store.getItem(newKey) === null) store.setItem(newKey, value);
        store.removeItem(oldKey);
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }
}

export { CUSTOM_DOMAIN_CNAME_TARGET } from "./public-config";
/** Hosting IP, accepted silently when a registrar can't CNAME (apex domains). */
export const CUSTOM_DOMAIN_A_RECORD = "185.158.133.1";

/** Fit Foundry's own support WhatsApp (digits, country code first). Gyms use their own number. */
export const SUPPORT_WHATSAPP: string =
  ((typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPPORT_WHATSAPP) as string | undefined)?.replace(/\D/g, "") ||
  "919845432219";

/** "+91 98454 32219" for Indian numbers; "+<digits>" otherwise. */
export function formatSupportWhatsapp(digits: string = SUPPORT_WHATSAPP): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}

/** https://wa.me/<number>, optionally with a prefilled message. */
export function supportWhatsappUrl(text?: string, digits: string = SUPPORT_WHATSAPP): string {
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Server-side value (env SUPPORT_WHATSAPP overrides) for emails. */
export function serverSupportWhatsapp(): string {
  const env = typeof process !== "undefined" ? process.env?.["SUPPORT_WHATSAPP"] : undefined;
  return env?.replace(/\D/g, "") || SUPPORT_WHATSAPP;
}

/** Plain + HTML footer line for Fit Foundry emails. */
export function supportEmailFooter() {
  const d = serverSupportWhatsapp();
  const shown = formatSupportWhatsapp(d);
  const url = supportWhatsappUrl(undefined, d);
  return {
    text: `Need help? WhatsApp us: ${shown} (${url})`,
    html: `<p style="margin-top:24px;font-size:12px;color:#64748b">Need help? WhatsApp us: <a href="${url}">${shown}</a></p>`,
  };
}
