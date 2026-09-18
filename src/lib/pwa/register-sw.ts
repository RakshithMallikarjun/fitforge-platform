/**
 * Service-worker cleanup while recovering clients from the former offline shell.
 *
 * Rules (do NOT relax):
 *  - Never register in dev, Lovable preview, iframes, or when ?sw=off is set.
 *  - In refused contexts, also unregister any pre-existing /sw.js to avoid
 *    stale caches leaking back into the editor preview.
 *
 * The app keeps the portable queue flush lifecycle:
 *  - visibilitychange + online events as portable fallbacks
 */

import { flushQueue } from "@/lib/pwa/offline-queue";

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      await r.unregister();
    }
  } catch {
    /* ignore */
  }
}

let flushHooksWired = false;
function wireFlushHooks() {
  if (flushHooksWired || typeof window === "undefined") return;
  flushHooksWired = true;

  const tryFlush = () => {
    void flushQueue().catch(() => {});
  };

  // Reconnection & foregrounding
  window.addEventListener("online", tryFlush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tryFlush();
  });

  // Best-effort initial flush on load
  tryFlush();
}

export async function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  wireFlushHooks();
  await unregisterAppSW();
}
