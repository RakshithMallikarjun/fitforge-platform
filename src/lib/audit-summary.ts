import { sentenceCase } from "@/lib/copy";

type Fields = Record<string, unknown>;
function fields(value: unknown): Fields {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : {};
}
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** "11 Oct 2026, 11:05 pm IST" — readable instant in the given zone. */
export function formatAuditTimestamp(iso: string, timeZone = "Asia/Kolkata"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const zone = timeZone === "Asia/Kolkata" ? "IST" : parts.timeZoneName;
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${String(parts.dayPeriod ?? "").toLowerCase()} ${zone}`.replace(/\s+/g, " ").trim();
}

function display(key: string, value: unknown, row: Fields): string {
  if (typeof value === "string" && ISO_TIMESTAMP.test(value)) return formatAuditTimestamp(value);
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "monthly_amount") {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? `${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${row.currency ?? ""}`.trim()
      : String(value);
  }
  if (typeof value === "object")
    return Object.entries(fields(value))
      .map(([k, v]) => `${sentenceCase(k)}: ${display(k, v, fields(value))}`)
      .join(", ");
  return key.includes("status") || key.includes("plan")
    ? sentenceCase(String(value))
    : String(value);
}

export function auditSummary(detail: unknown): string {
  const row = fields(detail);
  const before = fields(row.before);
  const after = fields(row.after);
  const changes = Object.keys(after)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => {
      const next = display(key, after[key], after);
      // The amount's updated value is enough; status changes show both states.
      return `${sentenceCase(key)}: ${key === "monthly_amount" ? next : `${display(key, before[key], before)} → ${next}`}`;
    });
  const extra = Object.entries(row)
    .filter(([key]) => key !== "before" && key !== "after")
    .map(([key, value]) => `${sentenceCase(key)}: ${display(key, value, row)}`);
  return [...changes, ...extra].join("; ") || "No field changes";
}
