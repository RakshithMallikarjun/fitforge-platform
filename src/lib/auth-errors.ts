/**
 * Maps raw Supabase auth errors to friendly, user-facing copy.
 * The verbatim message stays in the console for debugging.
 */
export function friendlyAuthError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    typeof error === "string"
      ? error
      : ((error as any)?.message as string | undefined) ?? "";
  if (raw) console.error("[auth]", raw, error);
  const m = raw.toLowerCase();

  if (m.includes("invalid login credentials")) return "That email or password isn't right.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox for the link.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account already exists for that email. Try signing in instead.";
  if (m.includes("password should be at least") || m.includes("password is too short"))
    return "Please choose a longer password (at least 8 characters).";
  if (m.includes("pwned") || m.includes("compromised") || m.includes("weak password"))
    return "That password has appeared in a data breach. Please choose a different one.";
  if (m.includes("same password") || m.includes("should be different"))
    return "Your new password must be different from your current one.";
  if (m.includes("over_email_send_rate_limit") || m.includes("email rate limit"))
    return "Too many emails sent recently. Please wait a few minutes and try again.";
  if (m.includes("rate limit") || m.includes("too many requests"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("token has expired") || m.includes("invalid token") || m.includes("otp_expired"))
    return "That link has expired. Please request a new one.";
  if (m.includes("unknown gym code") || m.includes("unknown gym"))
    return "We couldn't find that gym code.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "New sign-ups are currently closed. Please contact your gym.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "We couldn't reach the server. Check your connection and try again.";
  return fallback;
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; hints: string[] };

export function scorePassword(pw: string): PasswordStrength {
  const hints: string[] = [];
  if (pw.length < 8) hints.push("At least 8 characters");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) hints.push("Mix upper and lower case");
  if (!/[0-9]/.test(pw)) hints.push("Add a number");
  if (!/[^A-Za-z0-9]/.test(pw)) hints.push("Add a symbol");

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][clamped];
  return { score: clamped, label, hints };
}
