import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CUSTOM_DOMAIN_A_RECORD, CUSTOM_DOMAIN_CNAME_TARGET } from "@/lib/platform-brand";

export type DomainStatus = "not_set" | "waiting" | "active";

async function dohLookup(name: string, type: "CNAME" | "A"): Promise<string[]> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { Answer?: { data: string }[] };
  return (json.Answer ?? []).map((a) => a.data.replace(/\.$/, "").toLowerCase());
}

/** DNS check for the caller's gym custom domain. */
export const checkCustomDomain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        domain: z
          .string()
          .trim()
          .toLowerCase()
          .max(253)
          .regex(/^$|^([a-z0-9-]+\.)+[a-z]{2,}$/, "Enter a domain like app.yourgym.com"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ status: DomainStatus; found: string[] }> => {
    if (!data.domain) return { status: "not_set", found: [] };
    try {
      const [cname, a] = await Promise.all([
        dohLookup(data.domain, "CNAME"),
        dohLookup(data.domain, "A"),
      ]);
      const ok = cname.includes(CUSTOM_DOMAIN_CNAME_TARGET) || a.includes(CUSTOM_DOMAIN_A_RECORD);
      return { status: ok ? "active" : "waiting", found: [...cname, ...a].slice(0, 5) };
    } catch {
      return { status: "waiting", found: [] };
    }
  });

/** Platform feature flags read from server env. */
export const getPlatformFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ subdomainsEnabled: process.env.SUBDOMAINS_ENABLED === "true" }));
