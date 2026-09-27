/**
 * Turns any server/database error into one sentence a person can read.
 * Never shows raw JSON, Zod output or Postgres text.
 */
type Issue = { path?: (string | number)[]; message?: string; code?: string; validation?: string };

const FRIENDLY_ISSUE: Record<string, string> = {
  email: "Enter a valid email address",
  url: "Enter a valid web address",
  uuid: "Pick a valid item",
};

function humanize(key: string): string {
  const s = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function issuesOf(err: unknown): Issue[] | null {
  const anyErr = err as any;
  if (Array.isArray(anyErr?.issues)) return anyErr.issues;
  const msg: string | undefined = typeof err === "string" ? err : anyErr?.message;
  if (!msg) return null;
  const t = msg.trim();
  if (!t.startsWith("[") && !t.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(t);
    const list = Array.isArray(parsed) ? parsed : parsed?.issues;
    if (Array.isArray(list) && list.every((i) => i && typeof i === "object" && "message" in i))
      return list;
  } catch {
    /* not JSON */
  }
  return null;
}

function issueMessage(i: Issue): string {
  if (i.validation && FRIENDLY_ISSUE[i.validation]) return FRIENDLY_ISSUE[i.validation];
  if (i.code === "invalid_type" && /required/i.test(i.message ?? "")) return "This is required";
  if (i.code === "too_small") return i.message?.replace(/^String/, "Must") ?? "Too short";
  return i.message ?? "Invalid value";
}

/** Field → message map for forms that want to show errors next to inputs. */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issuesOf(err) ?? []) {
    const key = String(i.path?.[i.path.length - 1] ?? "");
    if (key && !out[key]) out[key] = issueMessage(i);
  }
  return out;
}

export function formatServerError(
  err: unknown,
  fieldLabels: Record<string, string> = {},
  fallback = "Something went wrong. Please try again.",
): string {
  const issues = issuesOf(err);
  if (issues?.length) {
    return issues
      .slice(0, 3)
      .map((i) => {
        const key = String(i.path?.[i.path.length - 1] ?? "");
        const label = key ? (fieldLabels[key] ?? humanize(key)) : "";
        return label ? `${label}: ${issueMessage(i)}` : issueMessage(i);
      })
      .join(" · ");
  }
  const msg: string = (typeof err === "string" ? err : (err as any)?.message) ?? "";
  if (!msg) return fallback;
  if (/row-level security|permission denied|42501/i.test(msg) || /^forbidden/i.test(msg)) {
    console.error("[permission]", err);
    return "You don't have permission to do that.";
  }
  if (/duplicate key|violates unique/i.test(msg)) {
    console.error("[db]", err);
    return "That already exists.";
  }
  if (/violates|relation|column|syntax error|null value|foreign key|PGRST|JWT/i.test(msg)) {
    console.error("[db]", err);
    return fallback;
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (msg.length > 240 || msg.includes("{")) {
    console.error("[error]", err);
    return fallback;
  }
  return msg;
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
