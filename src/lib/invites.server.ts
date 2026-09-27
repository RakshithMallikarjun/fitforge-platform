/**
 * Single invite path for every "invite someone to a gym" flow (owner, staff,
 * member, CSV import, resends).
 *
 * We generate the auth link ourselves (Auth Admin API) with an explicit
 * redirect to /accept-invite, then send a branded email through Resend — the
 * default auth email is never used for invites.
 */
import { getRequest } from "@tanstack/react-start/server";
import { PLATFORM_NAME, PLATFORM_URL } from "./platform-brand";

export type InviteRole = "owner" | "admin" | "trainer" | "member";

export type SendAccountInviteInput = {
  email: string;
  gymId: string;
  role: InviteRole;
  invitedByName?: string | null;
  displayName?: string | null;
};

export type SendAccountInviteResult = { userId: string; emailSent: true; resend: boolean };

const ROLE_LABEL: Record<InviteRole, string> = {
  owner: "Owner",
  admin: "Admin",
  trainer: "Trainer",
  member: "Member",
};

function appUrl(): string {
  const env = process.env["APP_URL"]?.trim().replace(/\/+$/, "");
  if (env) return env;
  try {
    const req = getRequest();
    const origin = req ? new URL(req.url).origin : "";
    if (origin) return origin;
  } catch {
    // no request context
  }
  return PLATFORM_URL;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function safeColor(c: string | null | undefined): string {
  if (!c) return "#E4572E";
  const v = c.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  return "#E4572E";
}

type GymBrand = {
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  support_email: string | null;
  support_phone: string | null;
};

function buildEmail(opts: {
  gym: GymBrand;
  role: InviteRole;
  inviterName: string | null;
  link: string;
  inviteeEmail: string;
  inviteeName: string | null;
}) {
  const { gym, role, inviterName, link, inviteeName, inviteeEmail } = opts;
  const who = inviteeName?.trim() || inviteeEmail;
  const roleLabel = ROLE_LABEL[role];
  const color = safeColor(gym.primary_color);
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  // Unique subject per gym + role + recipient so Gmail never threads different invites.
  const subject =
    role === "owner"
      ? `Your gym ${gym.name} is ready on ${PLATFORM_NAME} (${who})`
      : `${inviterName || gym.name} invited ${who} to ${gym.name} on ${PLATFORM_NAME} (${roleLabel})`;
  const roleLine =
    role === "owner"
      ? `You've been added as the Owner of ${gym.name}.`
      : `You've been added as ${role === "admin" ? "an" : "a"} ${roleLabel} at ${gym.name}.`;
  const contact: string[] = [];
  if (gym.support_email) contact.push(`Email: ${gym.support_email}`);
  if (gym.support_phone) contact.push(`WhatsApp / phone: ${gym.support_phone}`);

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${color};padding:24px;text-align:center">
${gym.logo_url ? `<img src="${esc(gym.logo_url)}" alt="${esc(gym.name)}" height="56" style="height:56px;max-width:200px;border-radius:8px;display:block;margin:0 auto 10px">` : ""}
<div style="color:#ffffff;font-size:22px;font-weight:bold">${esc(gym.name)}</div>
</td></tr>
<tr><td style="padding:28px 28px 8px">
<p style="font-size:16px;margin:0 0 12px">Hi,</p>
<p style="font-size:16px;margin:0 0 12px">${esc(roleLine)}</p>
${inviterName ? `<p style="font-size:14px;color:#57534e;margin:0 0 20px">Invited by ${esc(inviterName)}.</p>` : ""}
<p style="text-align:center;margin:24px 0"><a href="${esc(link)}" style="background:${color};color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:10px;display:inline-block">Accept invite</a></p>
<p style="font-size:13px;color:#57534e;margin:0 0 8px">This link expires in 24 hours.</p>
${contact.length ? `<p style="font-size:13px;color:#57534e;margin:0 0 8px">Questions? Contact ${esc(gym.name)} — ${contact.map(esc).join(" · ")}</p>` : ""}
<p style="font-size:12px;color:#a8a29e;margin:16px 0 0;word-break:break-all">If the button doesn't work, paste this link into your browser:<br>${esc(link)}</p>
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #e7e5e4;font-size:12px;color:#a8a29e;text-align:center">Sent by ${PLATFORM_NAME} on behalf of ${esc(gym.name)} · ${esc(stamp)} UTC</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    gym.name,
    "",
    roleLine,
    inviterName ? `Invited by ${inviterName}.` : "",
    "",
    `Accept invite: ${link}`,
    "",
    "This link expires in 24 hours.",
    contact.length ? `Questions? Contact ${gym.name} — ${contact.join(" · ")}` : "",
    "",
    `Sent by ${PLATFORM_NAME} on behalf of ${gym.name}`,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");

  return { subject, html, text };
}

async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string | null;
}) {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["INVITE_FROM"];
  if (!key || !from) throw new Error("Invite email is not configured (RESEND_API_KEY / INVITE_FROM).");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[invites] Resend failed [${res.status}]: ${body}`);
    throw new Error(`The invite email could not be sent (${res.status}).`);
  }
}

export async function sendAccountInvite(
  input: SendAccountInviteInput,
): Promise<SendAccountInviteResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = input.email.trim().toLowerCase();

  const { data: gym, error: gErr } = await supabaseAdmin
    .from("gyms")
    .select("name, slug, logo_url, primary_color, support_email, support_phone")
    .eq("id", input.gymId)
    .maybeSingle();
  if (gErr || !gym) throw new Error("Gym not found");

  const redirectTo = `${appUrl()}/accept-invite`;
  const metadata: Record<string, string> = { gym_slug: gym.slug };
  if (input.displayName) metadata.display_name = input.displayName;

  // Existing account? Resend via a recovery link as long as they never signed in.
  const { data: existingRow } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let link: string | undefined;
  let userId: string | undefined;
  let resend = false;

  if (existingRow?.id) {
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(existingRow.id);
    if (au?.user?.last_sign_in_at) {
      throw new Error(
        "This person has already signed in — ask them to use Forgot password instead.",
      );
    }
    resend = true;
  }

  // Always issue an invite-type link for unconfirmed accounts, so the newest
  // email is the one that works. Only fall back to recovery when the account
  // is already confirmed (invite type is then refused).
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo, data: metadata },
  });
  if (error && /already|registered|exists/i.test(error.message)) {
    const r = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (r.error) throw new Error(r.error.message);
    link = r.data.properties?.action_link;
    userId = r.data.user?.id;
    resend = true;
  } else if (error) {
    throw new Error(error.message);
  } else {
    link = data.properties?.action_link;
    userId = data.user?.id ?? existingRow?.id;
  }
  if (!link || !userId) throw new Error("Could not create the invite link");

  const { subject, html, text } = buildEmail({
    gym,
    role: input.role,
    inviterName: input.invitedByName ?? null,
    link,
    inviteeEmail: email,
    inviteeName: input.displayName ?? null,
  });
  await sendViaResend({ to: email, subject, html, text, replyTo: gym.support_email });

  return { userId, emailSent: true, resend };
}

/** Display name of the person sending an invite, for the email copy. */
export async function inviterName(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("users")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? data?.email ?? null;
}
