// Imported into the generated service worker by vite-plugin-pwa (workbox.importScripts).
// Listens for Background Sync fires and notifies open clients to flush the offline queue.
self.addEventListener("sync", (event) => {
  if (event.tag !== "fitforge-log-sync") return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "FITFORGE_FLUSH_QUEUE" });
      }
    })(),
  );
});
