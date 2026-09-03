import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  ErrorState,
  KpiCard,
  PaymentChip,
  fmtDate,
  relTime,
} from "@/components/platform/platform-ui";
import {
  getPlatformActivityTrend,
  getPlatformOverview,
  getPlatformSignupTrend,
  listPlatformGyms,
  type PaymentStatus,
} from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/")({
  component: PlatformOverviewPage,
});

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PlatformOverviewPage() {
  const overview = useQuery({ queryKey: ["platform-overview"], queryFn: () => getPlatformOverview() });
  const signups = useQuery({
    queryKey: ["platform-signups", 90],
    queryFn: () => getPlatformSignupTrend({ data: { days: 90 } }),
  });
  const activity = useQuery({
    queryKey: ["platform-activity", 30],
    queryFn: () => getPlatformActivityTrend({ data: { days: 30 } }),
  });
  const gyms = useQuery({ queryKey: ["platform-gyms"], queryFn: () => listPlatformGyms() });

  const o = overview.data;
  const gymRows = gyms.data ?? [];
  const needsAttention = [...gymRows]
    .filter((g) => g.is_enabled && (g.days_since_activity === null || g.days_since_activity >= 14))
    .sort((a, b) => (b.days_since_activity ?? 9999) - (a.days_since_activity ?? 9999));
  const overdue = gymRows.filter(
    (g) => g.payment_status === "overdue" || g.payment_status === "failed",
  );

  const activityData = activity.data ?? [];
  const hasActivity = activityData.some((d) => d.workouts + d.checkins > 0);
  const signupData = signups.data ?? [];
  const hasSignups = signupData.some((d) => d.gyms_created + d.members_created > 0);

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
      <header>
        <h1 className="text-lg font-bold tracking-tight">Platform overview</h1>
        <p className="text-xs text-muted-foreground">
          Every gym on FitForge. Aggregates only — no member data is shown here.
        </p>
      </header>

      {overview.isError ? (
        <ErrorState
          message={(overview.error as Error)?.message ?? "Failed to load"}
          onRetry={() => overview.refetch()}
        />
      ) : !o ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total gyms" value={o.total_gyms} />
            <KpiCard label="Enabled" value={o.enabled_gyms} />
            <KpiCard label="Disabled" value={o.disabled_gyms} tone={o.disabled_gyms ? "warn" : "default"} />
            <KpiCard
              label="Engaged (30d)"
              value={o.engaged_gyms_30d}
              hint="Gyms with at least one logged workout or check-in in the last 30 days."
            />
            <KpiCard
              label="At risk"
              value={o.at_risk_gyms}
              tone={o.at_risk_gyms ? "bad" : "default"}
              hint="Enabled gyms with no workout or check-in in the last 14 days."
            />
            <KpiCard
              label="Overdue"
              value={o.overdue_gyms}
              tone={o.overdue_gyms ? "bad" : "default"}
              hint="Payment status manually recorded as overdue or failed."
            />
            <KpiCard label="Total members" value={o.total_members} hint={`${o.active_members} active accounts`} />
            <KpiCard
              label="MAU"
              value={o.mau}
              hint={`DAU ${o.dau} · WAU ${o.wau} · stickiness ${
                o.stickiness ? `${Math.round(Number(o.stickiness) * 100)}%` : "—"
              }`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Signups" subtitle="Gyms and members created, last 90 days">
              {signups.isError ? (
                <ErrorState message={(signups.error as Error).message} onRetry={() => signups.refetch()} />
              ) : signups.isLoading ? (
                <Skeleton className="h-56 rounded-xl" />
              ) : !hasSignups ? (
                <EmptyState>No signups recorded in this window yet.</EmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={signupData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <RTooltip />
                    <Area type="monotone" dataKey="members_created" name="Members" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="gyms_created" name="Gyms" stroke="hsl(var(--secondary))" fill="hsl(var(--secondary))" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Platform activity" subtitle="Workouts, check-ins and active members per day (30d)">
              {activity.isError ? (
                <ErrorState message={(activity.error as Error).message} onRetry={() => activity.refetch()} />
              ) : activity.isLoading ? (
                <Skeleton className="h-56 rounded-xl" />
              ) : !hasActivity ? (
                <EmptyState>No workouts or check-ins in the last 30 days.</EmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <RTooltip />
                    <Line type="monotone" dataKey="workouts" name="Workouts" stroke="hsl(var(--primary))" dot={false} />
                    <Line type="monotone" dataKey="checkins" name="Check-ins" stroke="hsl(var(--secondary))" dot={false} />
                    <Line type="monotone" dataKey="active_members" name="Active members" stroke="hsl(var(--muted-foreground))" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Gyms by payment status" subtitle="Operator-entered, not gateway-verified">
              {Object.keys(o.gyms_by_payment_status ?? {}).length === 0 ? (
                <EmptyState>No gyms yet.</EmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={Object.entries(o.gyms_by_payment_status).map(([k, v]) => ({ name: k, gyms: v }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <RTooltip />
                    <Bar dataKey="gyms" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Gyms by plan">
              {Object.keys(o.gyms_by_plan ?? {}).length === 0 ? (
                <EmptyState>No gyms yet.</EmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={Object.entries(o.gyms_by_plan).map(([k, v]) => ({ name: k, gyms: v }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <RTooltip />
                    <Bar dataKey="gyms" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Needs attention" subtitle="Enabled gyms with no activity for 14+ days, stalest first">
              {gyms.isError ? (
                <ErrorState message={(gyms.error as Error).message} onRetry={() => gyms.refetch()} />
              ) : gyms.isLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : needsAttention.length === 0 ? (
                <EmptyState>Every enabled gym has been active in the last two weeks.</EmptyState>
              ) : (
                <ul className="divide-y divide-border">
                  {needsAttention.slice(0, 10).map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                      <Link
                        to="/platform/gyms/$gymId"
                        params={{ gymId: g.id }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {g.name}
                      </Link>
                      <span className="shrink-0 text-xs text-destructive">
                        {g.last_activity_at ? relTime(g.last_activity_at) : "never active"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Overdue payments" subtitle="Manually recorded billing state">
              {gyms.isLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : overdue.length === 0 ? (
                <EmptyState>No gyms are marked overdue or failed.</EmptyState>
              ) : (
                <ul className="divide-y divide-border">
                  {overdue.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                      <Link
                        to="/platform/gyms/$gymId"
                        params={{ gymId: g.id }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {g.name}
                      </Link>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <PaymentChip status={g.payment_status as PaymentStatus} />
                        due {fmtDate(g.next_due_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
