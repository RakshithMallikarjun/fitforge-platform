import { cn } from "@/lib/utils";

export type MembershipStatus = "active" | "inactive" | "expiring" | "expired";

export function getMembershipStatus(active: boolean, expiresAt?: string | null): MembershipStatus {
  if (!active) return "inactive";
  if (expiresAt) {
    const exp = new Date(expiresAt).getTime();
    const now = Date.now();
    const days = (exp - now) / 86400000;
    if (days < 0) return "expired";
    if (days <= 14) return "expiring";
  }
  return "active";
}

const STYLES: Record<MembershipStatus, string> = {
  active: "bg-primary-soft text-primary",
  inactive: "bg-muted text-muted-foreground",
  expiring: "bg-secondary-soft text-secondary",
  expired: "bg-destructive/10 text-destructive",
};

const LABELS: Record<MembershipStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  expiring: "Expiring soon",
  expired: "Expired",
};

export function StatusBadge({ status, className }: { status: MembershipStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        STYLES[status],
        className,
      )}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  );
}
