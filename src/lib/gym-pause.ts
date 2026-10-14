import { supabase } from "@/integrations/supabase/client";

export type PauseInfo = {
  gymName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  gymSlug?: string | null;
};
const KEY = "fitfoundry:gym-paused";

/** Returns pause details when the signed-in user's gym is disabled, else null. */
export async function checkGymPaused(): Promise<PauseInfo | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const { data, error } = await supabase.rpc("my_gym_pause_info");
  if (error) return null; // never sign someone out on a network blip
  const row = (data ?? [])[0] as any;
  if (!row || row.is_enabled !== false) return null;
  return {
    gymName: row.gym_name,
    supportEmail: row.support_email,
    supportPhone: row.support_phone,
    gymSlug: row.gym_slug ?? null,
  };
}

/** Remember why, sign out, and land on /auth with the paused message. */
export async function signOutPaused(info: PauseInfo) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(info));
  } catch {
    /* ignore */
  }
  await supabase.auth.signOut();
  const q = new URLSearchParams({ reason: "gym_disabled" });
  if (info.gymSlug) q.set("gym", info.gymSlug);
  window.location.assign(`/auth?${q.toString()}`);
}

export function readPauseInfo(): PauseInfo | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PauseInfo) : null;
  } catch {
    return null;
  }
}

export function whatsappLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}
