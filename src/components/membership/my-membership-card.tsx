import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PERIOD_LABEL, getMyMembership } from "@/lib/membership-plans.functions";
import { formatMoney } from "@/lib/format-money";
import { formatShortDate } from "@/lib/format-date";

/** Read-only membership + receipts for the signed-in member. */
export function MyMembershipCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-membership"],
    queryFn: () => getMyMembership(),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <header className="mb-3 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Membership</h2>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          We couldn't load your membership right now. Pull to refresh in a moment.
        </p>
      ) : !data?.plan_name ? (
        <p className="text-sm text-muted-foreground">
          You're not on a membership plan yet. Ask the gym desk to set you up.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              style={data.badge_color ? { backgroundColor: data.badge_color } : undefined}
              className="text-xs"
            >
              {data.plan_name}
            </Badge>
            {data.period && (
              <span className="text-xs text-muted-foreground">{PERIOD_LABEL[data.period]}</span>
            )}
          </div>

          {data.ends_on && (
            <p className="text-sm">
              Valid until <span className="font-semibold">{formatShortDate(data.ends_on)}</span>
              <span className="text-muted-foreground">
                {" "}
                ·{" "}
                {(() => {
                  const days = differenceInCalendarDays(
                    new Date(`${data.ends_on}T00:00:00`),
                    new Date(`${data.today}T00:00:00`),
                  );
                  if (days < 0) return `expired ${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
                  if (days === 0) return "expires today";
                  return `${days} day${days === 1 ? "" : "s"} left`;
                })()}
              </span>
            </p>
          )}

          {data.features.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {data.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Payment history</p>
            {data.payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {data.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {p.plan_name_snapshot} · {PERIOD_LABEL[p.period_snapshot]}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {formatShortDate(p.covers_from)} – {formatShortDate(p.covers_to)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold">
                        {formatMoney(p.amount, p.currency ?? data.currency)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatShortDate(p.paid_on)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
