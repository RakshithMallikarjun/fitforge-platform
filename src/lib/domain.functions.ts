import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateCustomDomain } from "@/lib/public-config";

export type DomainStatus = "not_set" | "waiting" | "active";

/** DNS check for the caller's gym custom domain. */
export const checkCustomDomain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        domain: z
          .string()
          .trim()
          .max(253)
          .refine((v) => !validateCustomDomain(v), { message: "Enter a domain like app.yourgym.com" }),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ status: DomainStatus; found: string[] }> => {
    if (!data.domain) return { status: "not_set", found: [] };
    try {
      const { lookupDomain } = await import("@/lib/domain.server");
      const { active, chain } = await lookupDomain(data.domain);
      return { status: active ? "active" : "waiting", found: chain.slice(0, 5) };
    } catch {
      return { status: "waiting", found: [] };
    }
  });

/** Platform feature flags read from server env. */
export const getPlatformFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ subdomainsEnabled: process.env.SUBDOMAINS_ENABLED === "true" }));

/** Where gym admins point their CNAME (always the branded target). */
export const getDomainConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { cnameTarget } = await import("@/lib/domain.server");
    return { cnameTarget: cnameTarget() };
  });
