/**
 * Registers /sw.js for signed-in users.
 *
 * Rules (do NOT relax):
 *  - Never register in dev, the Lovable editor preview, iframes, or with ?sw=off.
 *    In those contexts any existing worker is unregistered.
 *  - The worker URL carries the build hash (?v=…), so each deploy installs a new
 *    worker with fresh caches. A waiting worker only takes over when the user
 *    presses "Reload" on the update toast — never silently mid-workout.
 *  - VITE_SW_KILL_SWITCH=true registers the recovery worker (?kill=1), which
 *    clears every cache and unregisters itself.
 */
import { toast } from "sonner";
import { flushQueue } from "@/lib/pwa/offline-queue";

function refusedContext(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host === "localhost" || host.startsWith("id-preview--") || host.endsWith(".lovableproject.com"))
    return true;
  return new URLSearchParams(window.location.search).get("sw") === "off";
}

/** Build hash from this module's own hashed filename (e.g. /assets/register-sw-AbC123.js). */
function buildVersion(): string {
  const m = /-([A-Za-z0-9_-]{6,})\.js/.exec(import.meta.url);
  if (m) return m[1];
  const main = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  return main?.src.split("/").pop()?.replace(/\.js$/, "") ?? "0";
}

let flushHooksWired = false;
function wireFlushHooks() {
  if (flushHooksWired) return;
  flushHooksWired = true;
  const tryFlush = () => void flushQueue().catch(() => {});
  window.addEventListener("online", tryFlush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tryFlush();
  });
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.type === "FITFOUNDRY_FLUSH_QUEUE") tryFlush();
  });
  tryFlush();
}

function precacheLoadedAssets(reg: ServiceWorkerRegistration) {
  const urls = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => u.startsWith(window.location.origin + "/assets/"));
  (reg.active ?? reg.waiting ?? reg.installing)?.postMessage({ type: "PRECACHE", urls });
}

function promptUpdate(worker: ServiceWorker) {
  toast("A new version is available", {
    duration: Infinity,
    action: {
      label: "Reload",
      onClick: () => {
        navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
          once: true,
        });
        worker.postMessage({ type: "SKIP_WAITING" });
      },
    },
  });
}

let started: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null);
  wireFlushHooks();
  if (started) return started;
  started = (async () => {
    if (refusedContext()) {
      const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      return null;
    }
    const kill = import.meta.env.VITE_SW_KILL_SWITCH === "true";
    const url = `/sw.js?v=${encodeURIComponent(buildVersion())}${kill ? "&kill=1" : ""}`;
    try {
      const reg = await navigator.serviceWorker.register(url, { scope: "/" });
      if (kill) return null;
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          // Only an *update* waits; the very first install takes control directly.
          if (w.state === "installed" && navigator.serviceWorker.controller) promptUpdate(w);
        });
      });
      navigator.serviceWorker.ready.then(precacheLoadedAssets).catch(() => {});
      return reg;
    } catch (e) {
      console.error("[sw] registration failed", e);
      return null;
    }
  })();
  return started;
}

/** Whether push can be set up in this context (worker allowed). */
export function swAllowed(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && !refusedContext();
}
