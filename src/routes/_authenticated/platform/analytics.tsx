import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  HealthBar,
  KpiCard,
  pct,
} from "@/components/platform/platform-ui";
import {
  getFeatureAdoption,
  getPlatformActivityTrend,
  getPlatformOverview,
  getPlatformSignupTrend,
  getRetentionCohorts,
  listPlatformGyms,
} from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/analytics")({
  component: PlatformAnalyticsPage,
});

const RANGES = [30, 90, 180, 365];

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PlatformAnalyticsPage() {
  const [days, setDays] = useState(90);

  const overview = useQuery({ queryKey: ["platform-overview"], queryFn: () => getPlatformOverview() });
  const signups = useQuery({
    queryKey: ["platform-signups", days],
    queryFn: () => getPlatformSignupTrend({ data: { days } }),
  });
  const activity = useQuery({
    queryKey: ["platform-activity", days],
    queryFn: () => getPlatformActivityTrend({ data: { days } }),
  });
  const adoption = useQuery({ queryKey: ["platform-adoption"], queryFn: () => getFeatureAdoption() });
  const retention = useQuery({
    queryKey: ["platform-retention", 6],
    queryFn: () => getRetentionCohorts({ data: { months: 6 } }),
  });
  const gyms = useQuery({ queryKey: ["platform-gyms"], queryFn: () => listPlatformGyms() });

  const o = overview.data;
  const signupData = signups.data ?? [];
  const activityData = activity.data ?? [];
  const cohorts = retention.data ?? [];
  const a = adoption.data;
  const leaderboard = [...(gyms.data ?? [])]
    .filter((g) => g.member_count > 0)
    .sort((x, y) => Number(y.health_score) - Number(x.health_score))
    .slice(0, 10);

  const adoptionRows: Array<[string, number | null]> = a
    ? [
        ["Workout plans", a.plans],
        ["Assessments", a.assessments],
        ["Check-ins", a.checkins],
        ["QR check-ins", a.qr_checkins],
        ["Messaging", a.messaging],
        ["AI overload", a.ai_overload],
        ["Progress photos", a.progress_photos],
      ]
    : [];

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Platform analytics</h1>
          <p className="text-xs text-muted-foreground">
            Cross-gym aggregates. Days are bucketed in each gym's own timezone.
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={days === r ? "default" : "outline"}
              onClick={() => setDays(r)}
            >
              {r}d
            </Button>
          ))}
        </div>
      </header>

      {overview.isError ? (
        <ErrorState message={(overview.error as Error).message} onRetry={() => overview.refetch()} />
      ) : !o ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="New gyms 30d" value={o.new_gyms_30d} />
          <KpiCard label="New members 30d" value={o.new_members_30d} />
          <KpiCard
            label="Stickiness"
            value={o.stickiness ? `${Math.round(Number(o.stickiness) * 100)}%` : "—"}
            hint="DAU divided by MAU across all gyms."
          />
          <KpiCard label="Plans created 30d" value={o.plans_30d} hint={`${o.assessments_30d} assessments in the same window`} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Growth" subtitle={`Gyms and members created, last ${days} days`}>
          {signups.isError ? (
            <ErrorState message={(signups.error as Error).message} onRetry={() => signups.refetch()} />
          ) : signups.isLoading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : !signupData.some((d) => d.gyms_created + d.members_created > 0) ? (
            <EmptyState>No signups in this window.</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={signupData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RTooltip />
                <Bar dataKey="members_created" name="Members" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gyms_created" name="Gyms" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Engagement" subtitle={`Workouts, check-ins and active members, last ${days} days`}>
          {activity.isError ? (
            <ErrorState message={(activity.error as Error).message} onRetry={() => activity.refetch()} />
          ) : activity.isLoading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : !activityData.some((d) => d.workouts + d.checkins > 0) ? (
            <EmptyState>No activity recorded in this window.</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
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
        </Panel>

        <Panel title="Feature adoption" subtitle="Share of enabled gyms using each feature">
          {adoption.isError ? (
            <ErrorState message={(adoption.error as Error).message} onRetry={() => adoption.refetch()} />
          ) : adoption.isLoading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : !a || a.enabled_gyms === 0 ? (
            <EmptyState>No enabled gyms to measure yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {adoptionRows.map(([label, value]) => (
                <li key={label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{label}</span>
                    <span className="font-numeric text-muted-foreground">{pct(value)}</span>
                  </div>
                  <Progress value={Math.round((Number(value ?? 0)) * 100)} className="mt-1.5 h-1.5" />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Member retention" subtitle="Share of each signup cohort still active after 1–3 months">
          {retention.isError ? (
            <ErrorState message={(retention.error as Error).message} onRetry={() => retention.refetch()} />
          ) : retention.isLoading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : cohorts.length === 0 ? (
            <EmptyState>Not enough history for cohort analysis yet.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cohort</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">M1</TableHead>
                    <TableHead className="text-right">M2</TableHead>
                    <TableHead className="text-right">M3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohorts.map((c) => (
                    <TableRow key={c.cohort_month}>
                      <TableCell className="text-sm">{String(c.cohort_month).slice(0, 7)}</TableCell>
                      <TableCell className="font-numeric text-right text-sm">{c.cohort_size}</TableCell>
                      <TableCell className="font-numeric text-right text-sm">
                        {c.cohort_size ? pct(c.active_m1 / c.cohort_size) : "—"}
                      </TableCell>
                      <TableCell className="font-numeric text-right text-sm">
                        {c.cohort_size ? pct(c.active_m2 / c.cohort_size) : "—"}
                      </TableCell>
                      <TableCell className="font-numeric text-right text-sm">
                        {c.cohort_size ? pct(c.active_m3 / c.cohort_size) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Healthiest gyms" subtitle="Top 10 by composite health score">
        {gyms.isError ? (
          <ErrorState message={(gyms.error as Error).message} onRetry={() => gyms.refetch()} />
        ) : gyms.isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : leaderboard.length === 0 ? (
          <EmptyState>No gyms with members yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gym</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Workouts 30d</TableHead>
                  <TableHead className="text-right">Check-ins 30d</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <Link
                        to="/platform/gyms/$gymId"
                        params={{ gymId: g.id }}
                        className="font-medium hover:underline"
                      >
                        {g.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-numeric text-right text-sm">{g.member_count}</TableCell>
                    <TableCell className="font-numeric text-right text-sm">{g.workouts_30d}</TableCell>
                    <TableCell className="font-numeric text-right text-sm">{g.checkins_30d}</TableCell>
                    <TableCell><HealthBar score={g.health_score} memberCount={g.member_count} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </main>
  );
}
