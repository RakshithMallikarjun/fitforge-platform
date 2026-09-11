/**
 * One place for every user-facing date string.
 *
 * Before this module the app mixed `toLocaleDateString()` (which renders
 * "31/08/2026" in some locales) with ad-hoc date-fns calls, so the same date
 * looked different on every screen. Always format through these helpers.
 *
 * `timeZone` is optional: pass the gym's IANA zone where it is known, otherwise
 * the viewer's device zone is used.
 */
import { format } from "date-fns";

type DateInput = string | number | Date | null | undefined;

/** Parse a value that may be a bare YYYY-MM-DD (treated as a calendar day). */
function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const bareDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(bareDay ? `${value}T00:00:00` : value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Return a Date whose *local* fields match the wall clock in `timeZone`, so
 * date-fns patterns render that zone's values without extra dependencies.
 */
function inZone(date: Date, timeZone?: string): Date {
  if (!timeZone) return date;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return new Date(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second"),
    );
  } catch {
    return date;
  }
}

/** "31 Aug 2026" */
export function formatShortDate(value: DateInput, timeZone?: string): string {
  const d = toDate(value);
  if (!d) return "—";
  return format(inZone(d, timeZone), "d MMM yyyy");
}

/** "Mon 31 Aug" */
export function formatDayDate(value: DateInput, timeZone?: string): string {
  const d = toDate(value);
  if (!d) return "—";
  return format(inZone(d, timeZone), "EEE d MMM");
}

/** "31 Aug 2026, 18:04" */
export function formatDateTime(value: DateInput, timeZone?: string): string {
  const d = toDate(value);
  if (!d) return "—";
  return format(inZone(d, timeZone), "d MMM yyyy, HH:mm");
}

/** "18:04" */
export function formatTime(value: DateInput, timeZone?: string): string {
  const d = toDate(value);
  if (!d) return "—";
  return format(inZone(d, timeZone), "HH:mm");
}

/** "Today" / "Yesterday" / "6d ago" / "31 Aug 2026" for anything older. */
export function formatRelativeDay(value: DateInput, timeZone?: string): string {
  const d = toDate(value);
  if (!d) return "Never";
  const startOfDay = (x: Date) => {
    const z = inZone(x, timeZone);
    return new Date(z.getFullYear(), z.getMonth(), z.getDate()).getTime();
  };
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(d, timeZone);
}
