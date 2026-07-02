/**
 * QR check-in token issuance + verification.
 *
 * Members request a short-lived HMAC-signed token, encode it in a QR at
 * /app/checkin, and admins scan it at /admin/checkin. The admin server fn
 * verifies the signature + expiry, then writes an attendance_logs row.
 */
import { createServerFn } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TOKEN_TTL_SECONDS = 5 * 60;

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

type TokenBody = { u: string; g: string; t: number };

export const issueCheckinToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const secret = process.env.CHECKIN_HMAC_SECRET;
    if (!secret) throw new Error("Check-in secret not configured");

    const { data: u } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", userId)
      .maybeSingle();
    if (!u?.gym_id) throw new Error("No gym");

    const body: TokenBody = { u: userId, g: u.gym_id, t: Math.floor(Date.now() / 1000) };
    const payload = b64url(JSON.stringify(body));
    const sig = sign(payload, secret);
    return { token: `${payload}.${sig}`, expiresIn: TOKEN_TTL_SECONDS };
  });

export const verifyAndCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const secret = process.env.CHECKIN_HMAC_SECRET;
    if (!secret) throw new Error("Check-in secret not configured");

    // Caller must be admin or trainer in the same gym as the token.
    const [{ data: me }, { data: roles }] = await Promise.all([
      supabase.from("users").select("gym_id").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const rs = new Set((roles ?? []).map((r: any) => r.role));
    if (!rs.has("admin") && !rs.has("trainer")) throw new Error("Forbidden");
    if (!me?.gym_id) throw new Error("No gym");

    const parts = data.token.split(".");
    if (parts.length !== 2) throw new Error("Invalid token");
    const [payload, sig] = parts;
    const expected = sign(payload, secret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid signature");

    let body: TokenBody;
    try {
      body = JSON.parse(b64urlDecode(payload).toString("utf8"));
    } catch {
      throw new Error("Malformed token");
    }
    const age = Math.floor(Date.now() / 1000) - body.t;
    if (age > TOKEN_TTL_SECONDS || age < -60) throw new Error("Token expired");
    if (body.g !== me.gym_id) throw new Error("Wrong gym");

    // Insert attendance
    const { error } = await supabase
      .from("attendance_logs")
      .insert({ gym_id: body.g, member_id: body.u, check_in_at: new Date().toISOString() });
    if (error) throw new Error(error.message);

    const { data: member } = await supabase
      .from("users")
      .select("id, display_name, email, photo_url")
      .eq("id", body.u)
      .maybeSingle();

    return { ok: true as const, member };
  });

/** Manual check-in from Member 360 (admin/trainer front desk). */
export const logAttendanceManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: me }, { data: roles }] = await Promise.all([
      supabase.from("users").select("gym_id").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const rs = new Set((roles ?? []).map((r: any) => r.role));
    if (!rs.has("admin") && !rs.has("trainer")) throw new Error("Forbidden");
    if (!me?.gym_id) throw new Error("No gym");

    const { error } = await supabase.from("attendance_logs").insert({
      gym_id: me.gym_id,
      member_id: data.memberId,
      check_in_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
