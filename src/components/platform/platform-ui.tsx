import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PaymentStatus } from "@/lib/platform.functions";

export function relTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return format(new Date(d), "d MMM yyyy");
  } catch {
    return "—";
  }
}

export function pct(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Math.round(Number(v) * 100)}%`;
}

export function num(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined) return "—";
  return Number(v).toFixed(digits);
}

const PAYMENT_CLASS: Record<PaymentStatus, string> = {
  paid: "bg-primary/10 text-primary",
  trialing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  overdue: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function PaymentChip({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PAYMENT_CLASS[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

export function healthBand(score: number, memberCount: number) {
  if (memberCount === 0) return { label: "No data", tone: "muted" as const };
  if (score >= 70) return { label: "Healthy", tone: "good" as const };
  if (score >= 40) return { label: "Watch", tone: "warn" as const };
  return { label: "At risk", tone: "bad" as const };
}

export function HealthBar({ score, memberCount }: { score: number; memberCount: number }) {
  const band = healthBand(Number(score ?? 0), memberCount);
  const color =
    band.tone === "good"
      ? "bg-primary"
      : band.tone === "warn"
        ? "bg-amber-500"
        : band.tone === "bad"
          ? "bg-destructive"
          : "bg-muted-foreground/40";
  return (
    <div className="min-w-[104px]">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${Math.max(2, Math.min(100, Number(score ?? 0)))}%` }}
          />
        </div>
        <span className="font-numeric text-xs font-semibold">
          {memberCount === 0 ? "—" : Math.round(Number(score ?? 0))}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{band.label}</span>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "warn" | "bad" | "good";
}) {
  const valueClass =
    tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`What does ${label} mean?`}
                className="grid h-4 w-4 place-items-center rounded-full border border-border text-[9px] text-muted-foreground"
              >
                ?
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className={`font-numeric mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CopyButton({ value, label }: { value: string | null | undefined; label?: string }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      aria-label={label ?? `Copy ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const forbidden = /forbidden/i.test(message);
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <p className="font-semibold text-destructive">
        {forbidden ? "Forbidden" : "Something went wrong"}
      </p>
      <p className="mt-1 text-muted-foreground">
        {forbidden ? "Your account is not a platform administrator." : message}
      </p>
      {onRetry && !forbidden && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[160px] place-items-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
