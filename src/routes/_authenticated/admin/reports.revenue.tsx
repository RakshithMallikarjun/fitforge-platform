import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERIOD_LABEL, getRevenueReport } from "@/lib/membership-plans.functions";
import { formatMoney } from "@/lib/format-money";

export const Route = createFileRoute("/_authenticated/admin/reports/revenue")({
  component: RevenueReportPage,
});

function RevenueReportPage() {
  const range = useMemo(() => {
    const today = new Date();
    return {
      from: format(subMonths(today, 11), "yyyy-MM-01"),
      to: format(today, "yyyy-MM-dd"),
    };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["revenue-report", range.from, range.to],
    queryFn: () => getRevenueReport({ data: range }),
  });

  return (
    <>
      <GlassHeader title="Revenue" subtitle="Membership collections by month, tier and term" />

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            We couldn't load the revenue report. Refresh to try again.
          </p>
        ) : !data || data.monthly.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground">
            <TrendingUp className="h-6 w-6" />
            No payments recorded yet.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-xs text-muted-foreground">Collected (last 12 months)</p>
              <p className="text-2xl font-bold tracking-tight">
                {formatMoney(data.total_collected, data.currency)}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <h2 className="mb-3 text-sm font-semibold">Monthly collections</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        color: "var(--foreground)",
                      }}
                      formatter={(v: any) => formatMoney(Number(v), data.currency)}
                    />
                    <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">By tier</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead>Payments</TableHead>
                      <TableHead>Collected</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_tier.map((t) => (
                      <TableRow key={t.plan_name}>
                        <TableCell className="text-sm">{t.plan_name}</TableCell>
                        <TableCell className="text-sm">{t.payment_count}</TableCell>
                        <TableCell className="text-sm">
                          {formatMoney(t.total, data.currency)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {data.active_by_tier.find((a) => a.plan_name === t.plan_name)
                            ?.active_count ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>

              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">By term</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Term</TableHead>
                      <TableHead>Payments</TableHead>
                      <TableHead>Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_term.map((t) => (
                      <TableRow key={t.period}>
                        <TableCell className="text-sm">{PERIOD_LABEL[t.period]}</TableCell>
                        <TableCell className="text-sm">{t.payment_count}</TableCell>
                        <TableCell className="text-sm">
                          {formatMoney(t.total, data.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
