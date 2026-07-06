import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const subscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subscription: any }) => {
    if (!d || typeof d !== "object" || !d.subscription) {
      throw new Error("Invalid subscription");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("users")
      .update({ push_subscription: data.subscription })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("users")
      .update({ push_subscription: null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPushStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("users")
      .select("push_subscription")
      .eq("id", context.userId)
      .maybeSingle();
    return { enabled: !!(data as any)?.push_subscription };
  });
