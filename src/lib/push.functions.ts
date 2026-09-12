import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Only real Web Push service endpoints may be stored — anything else would let
// a member point our server's outbound push POST (with its VAPID credentials)
// at an arbitrary URL.
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];
const ALLOWED_PUSH_HOST_SUFFIXES = [".notify.windows.com"];

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

function isValidPushSubscription(sub: unknown): boolean {
  if (!sub || typeof sub !== "object") return false;
  const s = sub as { endpoint?: unknown; keys?: unknown };
  if (typeof s.endpoint !== "string" || s.endpoint.length > 2000) return false;
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  const hostAllowed =
    ALLOWED_PUSH_HOSTS.includes(host) ||
    ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (!hostAllowed) return false;

  const keys = s.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  if (!keys || typeof keys !== "object") return false;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return false;
  // p256dh is an uncompressed P-256 point (65 bytes → ~88 base64url chars);
  // auth is a 16-byte secret (~22-24 chars). Allow reasonable slack only.
  if (!BASE64URL_RE.test(keys.p256dh) || keys.p256dh.length < 80 || keys.p256dh.length > 96)
    return false;
  if (!BASE64URL_RE.test(keys.auth) || keys.auth.length < 16 || keys.auth.length > 64)
    return false;
  return true;
}

export const subscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subscription: any }) => {
    if (!d || typeof d !== "object" || !isValidPushSubscription(d.subscription)) {
      throw new Error("Invalid push subscription");
    }
    const { endpoint, keys } = d.subscription;
    // Persist only the fields Web Push needs — drop anything extra.
    return {
      subscription: {
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      },
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("users")
      .update({ push_subscription: data.subscription })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("users")
      .update({ push_subscription: null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPushStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("users")
      .select("push_subscription")
      .eq("id", context.userId)
      .maybeSingle();
    return { enabled: !!(data as any)?.push_subscription };
  });
