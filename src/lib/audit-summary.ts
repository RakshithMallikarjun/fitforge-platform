import { sentenceCase } from "@/lib/copy";

type Fields = Record<string, unknown>;
function fields(value: unknown): Fields {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Fields : {};
}
function display(key: string, value: unknown, row: Fields): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "monthly_amount") {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${row.currency ?? ""}`.trim() : String(value);
  }
  if (typeof value === "object") return Object.entries(fields(value)).map(([k, v]) => `${sentenceCase(k)}: ${display(k, v, fields(value))}`).join(", ");
  return key.includes("status") || key.includes("plan") ? sentenceCase(String(value)) : String(value);
}

export function auditSummary(detail: unknown): string {
  const row = fields(detail);
  const before = fields(row.before);
  const after = fields(row.after);
  const changes = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) => {
    const next = display(key, after[key], after);
    // The amount's updated value is enough; status changes show both states.
    return `${sentenceCase(key)}: ${key === "monthly_amount" ? next : `${display(key, before[key], before)} → ${next}`}`;
  });
  const extra = Object.entries(row).filter(([key]) => key !== "before" && key !== "after").map(([key, value]) => `${sentenceCase(key)}: ${display(key, value, row)}`);
  return [...changes, ...extra].join("; ") || "No field changes";
}