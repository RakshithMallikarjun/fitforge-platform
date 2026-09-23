import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Sitemap entries must always point at the public site, never a preview host. */
const BASE_URL = "https://fitfoundry.in";

const ENTRIES: { path: string; changefreq: string; priority: string }[] = [
  // /auth is disallowed in robots.txt, so it must not be advertised here.
  { path: "/", changefreq: "weekly", priority: "1.0" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = BASE_URL;
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...ENTRIES.map(
            (e) =>
              `  <url><loc>${origin}${e.path}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
          ),
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
