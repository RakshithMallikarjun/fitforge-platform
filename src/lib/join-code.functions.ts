import { createServerFn } from "@tanstack/react-start";

/**
 * Verifies a gym slug + join code pair during sign-up.
 *
 * SECURITY: the underlying `verify_join_code` routine is no longer executable by
 * anonymous or signed-in database roles, so join codes cannot be brute-forced
 * straight through the Data API. Verification happens here, server-side only.
 */
export const verifyGymJoinCode = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; code: string }) => {
    const slug = String(d?.slug ?? "").trim();
    const code = String(d?.code ?? "").trim();
    if (!slug || slug.length > 64) throw new Error("Invalid gym code");
    if (!code || code.length > 64) throw new Error("Invalid join code");
    return { slug, code };
  })
  .handler(async ({ data }): Promise<{ valid: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: valid, error } = await supabaseAdmin.rpc("verify_join_code", {
      _slug: data.slug,
      _code: data.code,
    });
    if (error) {
      console.error("[join-code] verify failed", error.message);
      return { valid: false };
    }
    return { valid: valid === true };
  });
