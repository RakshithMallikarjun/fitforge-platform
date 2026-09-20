/**
 * Server-only web push. VAPID keys live in the existing notify-plan-assigned
 * edge function, which accepts an explicit title/body/url payload, so the
 * worker never handles push encryption itself.
 *
 * Never throws — a reminder message must land even when push is unavailable.
 */
export async function notifyUserPush(
  userId: string,
  title: string,
  body: string,
  url = "/app/profile",
) {
  const base = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const secret = process.env["NOTIFY_WEBHOOK_SECRET"];
  if (!base || !secret) return;
  try {
    const res = await fetch(`${base}/functions/v1/notify-plan-assigned`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify({ record: { member_id: userId }, title, body, url }),
    });
    if (!res.ok) {
      console.error(`[dues] push failed [${res.status}]: ${await res.text()}`);
    }
  } catch (e) {
    console.error("[dues] push error", e);
  }
}

/** Back-compat name used by the reminder path. */
export const notifyMemberPush = notifyUserPush;
