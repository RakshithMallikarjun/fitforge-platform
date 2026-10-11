import { supportEmailFooter } from "@/lib/platform-brand";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export const MEMBER_COUNT_OPTIONS = [
  { value: "under_50", label: "Under 50" },
  { value: "50_150", label: "50–150" },
  { value: "150_400", label: "150–400" },
  { value: "400_plus", label: "400+" },
] as const;

const leadSchema = z.object({
  contact_name: z.string().trim().min(1, "Your name is required").max(120),
  gym_name: z.string().trim().min(1, "Gym name is required").max(120),
  city: z.string().trim().min(1, "City is required").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 ()-]{5,30}$/, "Enter a valid phone number"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  member_count: z.enum(["under_50", "50_150", "150_400", "400_plus"]),
  website: z.string().max(0).optional(), // honeypot: bots fill it, people don't see it
});

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function notifyOwner(lead: z.infer<typeof leadSchema> & { id: string }) {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["SUMMARY_FROM_EMAIL"] || process.env["INVITE_FROM"];
  if (!key || !from) {
    console.error("[leads] email not configured; lead stored only", lead.id);
    return;
  }
  let to = (process.env["LEADS_NOTIFY_EMAIL"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length) {
    // Fall back to every platform owner's sign-in email (Auth Admin API).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin.from("platform_admins").select("user_id");
    for (const a of admins ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById((a as any).user_id);
      if (data?.user?.email) to.push(data.user.email);
    }
  }
  if (!to.length) return;
  const size = MEMBER_COUNT_OPTIONS.find((o) => o.value === lead.member_count)?.label ?? "";
  const rows: [string, string][] = [
    ["Name", lead.contact_name],
    ["Gym", lead.gym_name],
    ["City", lead.city],
    ["Phone", lead.phone],
    ["Email", lead.email],
    ["Members", size],
  ];
  const footer = supportEmailFooter();
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n${footer.text}`;
  const html = `<h2>New gym lead</h2><table>${rows
    .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`)
    .join("")}</table>${footer.html}`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `lead-${lead.id}`,
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: lead.email,
        subject: `New gym lead: ${lead.gym_name} (${lead.city})`,
        html,
        text,
      }),
    });
    if (!res.ok) console.error(`[leads] Resend ${res.status}: ${await res.text()}`);
  } catch (e: any) {
    console.error("[leads] Resend error", e?.message ?? e);
  }
}

/** Public: gym owners request setup from /get-started. */
export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => leadSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true }; // honeypot hit: pretend success
    const id = crypto.randomUUID();
    const { website: _w, ...row } = data;
    const { error } = await publicClient().from("platform_leads").insert({ id, ...row });
    if (error) {
      if (/too many/i.test(error.message)) throw new Error("Too many submissions — please try again later.");
      console.error("[leads] insert failed", error.message);
      throw new Error("We couldn't send that. Please try again.");
    }
    await notifyOwner({ ...data, id });
    return { ok: true };
  });

export type Lead = {
  id: string;
  contact_name: string;
  gym_name: string;
  city: string;
  phone: string;
  email: string;
  member_count: string;
  status: "new" | "contacted" | "converted";
  created_at: string;
};

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Lead[]> => {
    const { data: ok } = await context.supabase.rpc("is_platform_admin");
    if (!ok) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("platform_leads")
      .select("id, contact_name, gym_name, city, phone, email, member_count, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as Lead[];
  });

export const setLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["new", "contacted", "converted"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_platform_admin");
    if (!ok) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("platform_leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: name + logo for a valid gym code, used to brand the sign-up form. */
export const getPublicGymBrand = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,64}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: rows } = await publicClient().rpc("public_gym_manifest", {
      _slug: data.slug,
      _domain: null as any,
    });
    const g = (rows ?? [])[0] as any;
    return g ? { name: g.name as string, logoUrl: (g.logo_url as string | null) ?? null } : null;
  });

/** Public: name + support contacts for the "account paused" notice on /auth. */
export const getPublicGymPauseNotice = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,64}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: rows } = await publicClient().rpc("public_gym_pause_notice", { _slug: data.slug });
    const g = (rows ?? [])[0] as any;
    if (!g) return null;
    return {
      gymName: g.gym_name as string,
      isEnabled: !!g.is_enabled,
      supportEmail: (g.support_email as string | null) ?? null,
      supportPhone: (g.support_phone as string | null) ?? null,
    };
  });
