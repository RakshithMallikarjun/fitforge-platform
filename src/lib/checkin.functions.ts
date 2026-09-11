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

/** Unique index attendance_logs_member_day_uidx allows one check-in per member per day. */
function isDuplicateCheckin(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|already exists/i.test(error.message ?? "");
}

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

    // Insert attendance (one per member per UTC day, per attendance_logs_member_day_uidx)
    const now = new Date();
    const { error } = await supabase.from("attendance_logs").insert({
      gym_id: body.g,
      member_id: body.u,
      check_in_at: now.toISOString(),
      location_type: "gym",
    });
    const duplicate = isDuplicateCheckin(error as any);
    if (error && !duplicate) throw new Error(error.message);

    // A row already exists for today — it may be a self-reported home session.
    // A real front-desk scan is authoritative: promote it to 'gym'.
    let upgradedFromHome = false;
    if (duplicate) {
      const dayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      ).toISOString();
      const dayEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      ).toISOString();
      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("id, location_type")
        .eq("member_id", body.u)
        .gte("check_in_at", dayStart)
        .lt("check_in_at", dayEnd)
        .maybeSingle();
      if (existing) {
        upgradedFromHome = existing.location_type === "home";
        await supabase
          .from("attendance_logs")
          .update({ location_type: "gym", check_in_at: now.toISOString() })
          .eq("id", existing.id);
      }
    }

    const { data: member } = await supabase
      .from("users")
      .select("id, display_name, email, photo_url")
      .eq("id", body.u)
      .maybeSingle();

    return { ok: true as const, member, alreadyCheckedIn: duplicate, upgradedFromHome };
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

    // The target member must belong to the caller's gym.
    const { data: member } = await supabase
      .from("users")
      .select("id, gym_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!member || member.gym_id !== me.gym_id) {
      throw new Error("Member not found in your gym");
    }

    const { error } = await supabase.from("attendance_logs").insert({
      gym_id: me.gym_id,
      member_id: data.memberId,
      check_in_at: new Date().toISOString(),
    });
    const duplicate = isDuplicateCheckin(error as any);
    if (error && !duplicate) throw new Error(error.message);
    return { ok: true as const, alreadyCheckedIn: duplicate };
  });

/** Member-initiated self check-in (At Home / At Gym). */
export const selfCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { locationType: "gym" | "home" }) => {
    if (d?.locationType !== "gym" && d?.locationType !== "home") {
      throw new Error("Invalid location");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.gym_id) throw new Error("No gym");

    const { error } = await supabase.from("attendance_logs").insert({
      gym_id: me.gym_id,
      member_id: userId,
      check_in_at: new Date().toISOString(),
      location_type: data.locationType,
    });
    const duplicate = isDuplicateCheckin(error as any);
    if (error && !duplicate) throw new Error(error.message);
    return { ok: true as const, locationType: data.locationType, alreadyCheckedIn: duplicate };
  });
