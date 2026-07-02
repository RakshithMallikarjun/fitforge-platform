/**
 * Guarded service-worker registration.
 *
 * Rules (do NOT relax):
 *  - Never register in dev, Lovable preview, iframes, or when ?sw=off is set.
 *  - In refused contexts, also unregister any pre-existing /sw.js to avoid
 *    stale caches leaking back into the editor preview.
 *
 * Also wires the offline queue flush lifecycle:
 *  - Background Sync tag registration (best-effort; iOS lacks it)
 *  - visibilitychange + online events as portable fallbacks
 *  - postMessage from the SW ("FITFORGE_FLUSH_QUEUE") triggers a flush
 */

import { flushQueue } from "@/lib/pwa/offline-queue";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return true;
  return false;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
      if (url.endsWith("/sw.js")) await r.unregister();
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

  // Messages from the SW's sync handler
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if ((event.data as any)?.type === "FITFORGE_FLUSH_QUEUE") tryFlush();
    });
  }

  // Best-effort initial flush on load
  tryFlush();
}

async function registerBackgroundSyncTag() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const win = window as any;
  if (!("SyncManager" in win)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-expect-error — sync is a Background Sync API surface not in TS lib
    await reg.sync?.register("fitforge-log-sync");
  } catch {
    /* Some browsers require a persistent permission; ignore failures */
  }
}

export async function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // Hook flush lifecycle even in refused contexts — the queue itself is safe
  // to flush any time; only the SW registration is gated.
  wireFlushHooks();

  if (isRefusedContext()) {
    await unregisterAppSW();
    return;
  }
  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox("/sw.js");
    wb.addEventListener("waiting", () => {
      wb.messageSkipWaiting();
    });
    wb.addEventListener("controlling", () => {
      // New SW took control — reload once so users get the latest shell.
      window.location.reload();
    });
    await wb.register();
    await registerBackgroundSyncTag();
  } catch (err) {
    console.warn("[pwa] sw registration failed", err);
  }
}
