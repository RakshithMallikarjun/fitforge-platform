// Imported into the generated service worker by vite-plugin-pwa (workbox.importScripts).

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "FitForge", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "FitForge", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
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
