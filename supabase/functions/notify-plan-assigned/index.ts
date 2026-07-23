// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@fitforge.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require shared secret header so anonymous callers cannot spam pushes.
  const SHARED = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!SHARED || provided.length !== SHARED.length || provided !== SHARED) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    // Supabase DB webhook shape: { type, table, record, old_record, schema }
    const record = payload?.record ?? payload;
    const memberId: string | undefined = record?.member_id;
    if (!memberId) {
      return new Response(JSON.stringify({ error: "no member_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("push_subscription")
      .eq("id", memberId)
      .maybeSingle();
    if (error) throw error;

    const sub = (user as any)?.push_subscription;
    if (!sub) {
      return new Response(JSON.stringify({ ok: true, skipped: "no subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notification = {
      title: "New workout plan 💪",
      body: "Your trainer assigned you a new plan. Tap to view it.",
      data: { url: "/app/workouts" },
    };

    try {
      await webpush.sendNotification(sub, JSON.stringify(notification));
    } catch (err: any) {
      // Clear stale subscription on 404/410
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("users").update({ push_subscription: null }).eq("id", memberId);
      } else {
        throw err;
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("notify-plan-assigned error", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
