/**
 * Guarded service-worker registration.
 *
 * Rules (do NOT relax):
 *  - Never register in dev, Lovable preview, iframes, or when ?sw=off is set.
 *  - In refused contexts, also unregister any pre-existing /sw.js to avoid
 *    stale caches leaking back into the editor preview.
 */

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

export async function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
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
  } catch (err) {
    console.warn("[pwa] sw registration failed", err);
  }
}
