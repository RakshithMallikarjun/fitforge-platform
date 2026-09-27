/* Fit Foundry service worker.
 *
 * Version comes from the registration URL (?v=<build hash>), so every deploy
 * installs a new worker with its own caches. Rules:
 *  - Only hashed static assets (/assets/*, fonts, icons) are cached.
 *  - Navigations are network-first (3s timeout). A cached offline page is only
 *    used for /app routes when the network truly fails. Never a stale shell.
 *  - Server functions, Supabase, analytics: never cached (straight to network).
 *  - A new worker waits until the page asks it to take over (no silent reloads).
 *  - ?kill=1 turns this into the one-time recovery worker (clear + unregister).
 */
const params = new URL(self.location.href).searchParams;
const VERSION = params.get("v") || "dev";
const KILL = params.get("kill") === "1";
const STATIC_CACHE = `ff-static-${VERSION}`;
const OFFLINE_CACHE = `ff-offline-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  if (KILL) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    (async () => {
      const c = await caches.open(OFFLINE_CACHE);
      await c.addAll(PRECACHE).catch(() => {});
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      if (KILL) {
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await self.registration.unregister();
        for (const client of clients) if ("navigate" in client) await client.navigate(client.url);
        return;
      }
      const keep = new Set([STATIC_CACHE, OFFLINE_CACHE]);
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SKIP_WAITING") self.skipWaiting();
  if (msg.type === "PRECACHE" && Array.isArray(msg.urls)) {
    event.waitUntil(
      (async () => {
        const c = await caches.open(STATIC_CACHE);
        const urls = msg.urls.filter((u) => {
          try {
            return isHashedStatic(new URL(u, self.location.origin));
          } catch {
            return false;
          }
        });
        await Promise.all(urls.map((u) => c.add(u).catch(() => {})));
      })(),
    );
  }
});

function isHashedStatic(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/assets/")) return /\.(js|css|woff2?|ttf|png|svg|jpg|webp)$/.test(url.pathname);
  return url.pathname.startsWith("/icons/");
}

function neverCache(url) {
  return (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/api/") ||
    /supabase\.co$/.test(url.hostname)
  );
}

self.addEventListener("fetch", (event) => {
  if (KILL) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(navigate(req, url));
    return;
  }
  if (neverCache(url)) return;
  if (isHashedStatic(url)) {
    event.respondWith(
      (async () => {
        const c = await caches.open(STATIC_CACHE);
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })(),
    );
  }
});

async function navigate(req, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    return await fetch(req, { signal: controller.signal });
  } catch {
    if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    // Slow but alive network: keep waiting rather than faking an offline page.
    return fetch(req);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Push ----------
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Fit Foundry", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Fit Foundry", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/app";
  const url = typeof raw === "string" && raw.startsWith("/") ? raw : "/app";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// ---------- Background sync ----------
self.addEventListener("sync", (event) => {
  if (event.tag !== "fitfoundry-log-sync" && event.tag !== "fitforge-log-sync") return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      for (const client of clients) client.postMessage({ type: "FITFOUNDRY_FLUSH_QUEUE" });
    })(),
  );
});
