// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // we register from our own guarded wrapper
        devOptions: { enabled: false },
        filename: "sw.js",
        manifest: {
          name: "FitForge — Member",
          short_name: "FitForge",
          description: "Your gym in your pocket — workouts, plans, and progress.",
          theme_color: "#059669",
          background_color: "#F8FAFC",
          display: "standalone",
          orientation: "portrait",
          scope: "/app",
          start_url: "/app",
          id: "/app",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          navigateFallback: "/offline.html",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/admin/, /^\/auth/],
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkFirst",
              options: {
                cacheName: "pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:png|jpg|jpeg|svg|webp|gif|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
