/* One-time recovery worker: remove the obsolete offline app shell everywhere. */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();

      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await self.registration.unregister();

      for (const client of clients) {
        if ("navigate" in client) await client.navigate(client.url);
      }
    })(),
  );
});