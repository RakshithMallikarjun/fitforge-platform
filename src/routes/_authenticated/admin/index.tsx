import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpDown, ArrowUpRight, LifeBuoy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { GlassHeader } from "@/components/glass-header";
import { BentoStatCard } from "@/components/bento-stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getAdminStats, getTrainerStats, getRecentPayments, getEngagementReport,
  type TrainerStat, type PaymentRow, type EngagementRow,
} from "@/lib/admin-stats.functions";
import { useTheme } from "@/lib/theme-provider";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: user } = useCurrentUser();
  const { theme } = useTheme();
  const isAdmin = !!user?.roles.includes("admin");
  const initials = (user?.displayName ?? user?.email ?? "FF").slice(0, 2).toUpperCase();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getAdminStats(),
  });


  return (
    <>
      <GlassHeader
        title={`Welcome back, ${user?.displayName ?? "Coach"}`}
        subtitle="Here's what's happening across your gym today"
        initials={initials}
      />

      <main className="mx-auto max-w-[1280px] space-y-8 px-8 py-8">
        {/* Stats grid */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statsLoading || !stats ? (
            <>
              <Skeleton className="h-32 rounded-[2rem]" />
              <Skeleton className="h-32 rounded-[2rem]" />
              <Skeleton className="h-32 rounded-[2rem]" />
              <Skeleton className="h-32 rounded-[2rem]" />
            </>
          ) : (
            <>
              <BentoStatCard
                variant="dark"
                label="Active members"
                value={stats.activeMembers.toLocaleString()}
                footer={
                  <span className="inline-flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" /> {stats.newThisMonth} new this month
                  </span>
                }
              />
              <BentoStatCard label="New this month" value={stats.newThisMonth.toLocaleString()} footer="Members joined" />
              <BentoStatCard label="Sessions today" value={stats.sessionsToday.toLocaleString()} footer="Workouts logged" />
              <BentoStatCard label="Avg check-ins / day" value={stats.avgCheckIns7d.toString()} footer="Last 7 days" />
            </>
          )}
        </section>

        <TrainerPerformance />



        {/* Two-column main */}
        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <AtRiskMembers />
            {isAdmin && <PaymentHistory />}
          </div>

          {/* Side widgets */}
          <div className="space-y-6">
            {(theme.supportEmail || theme.supportPhone) && (
              <div className="relative overflow-hidden rounded-[2rem] bg-[oklch(0.28_0.07_232)] p-6 text-primary-foreground">
                <LifeBuoy className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5" />
                <h3 className="text-base font-bold tracking-tight">Need a hand?</h3>
                <p className="mt-1 text-xs text-white/80">
                  Reach your {theme.name} support contacts.
                </p>
                {theme.supportEmail && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4 rounded-lg"
                    onClick={() => {
                      window.location.href = `mailto:${theme.supportEmail}?subject=${encodeURIComponent(`Support request — ${theme.name}`)}&body=${encodeURIComponent(`User: ${user?.email ?? ""}\n\nPlease describe your issue:`)}`;
                    }}
                  >
                    Email support
                  </Button>
                )}
                {theme.supportPhone && (
                  <a
                    href={`https://wa.me/${theme.supportPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi ${theme.name}, I need help.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs font-medium text-white/90 underline underline-offset-4 hover:text-white"
                  >
                    Chat on WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

type SortKey = "name" | "assignedMembers" | "plansThisMonth" | "assessmentsThisMonth";

function TrainerPerformance() {
  const { data, isLoading } = useQuery({
    queryKey: ["trainer-stats"],
    queryFn: () => getTrainerStats(),
  });
  const [sort, setSort] = useState<SortKey>("assignedMembers");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const arr = [...(data ?? [])];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort === "name") cmp = (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email);
      else cmp = (a[sort] as number) - (b[sort] as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [data, sort, dir]);

  function toggle(k: SortKey) {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(k); setDir(k === "name" ? "asc" : "desc"); }
  }

  return (
    <section className="rounded-[2rem] border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="p-6 pb-2">
        <h2 className="text-base font-bold tracking-tight">Trainer performance</h2>
        <p className="text-xs text-muted-foreground">Assigned members and month-to-date activity</p>
      </div>
      {isLoading ? (
        <div className="space-y-2 p-6">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Sort onClick={() => toggle("name")}>Trainer</Sort></TableHead>
              <TableHead><Sort onClick={() => toggle("assignedMembers")}>Members</Sort></TableHead>
              <TableHead><Sort onClick={() => toggle("plansThisMonth")}>Plans this month</Sort></TableHead>
              <TableHead><Sort onClick={() => toggle("assessmentsThisMonth")}>Assessments this month</Sort></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t: TrainerStat) => (
              <TableRow key={t.trainerId}>
                <TableCell className="font-medium">{t.displayName ?? t.email}</TableCell>
                <TableCell className="font-numeric">{t.assignedMembers}</TableCell>
                <TableCell className="font-numeric">{t.plansThisMonth}</TableCell>
                <TableCell className="font-numeric">{t.assessmentsThisMonth}</TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  No trainers yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function Sort({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={onClick}>
      {children} <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );
}


/** Members whose 30-day engagement has dropped — same signal as the engagement report. */
function AtRiskMembers() {
  const fetchEngagement = useServerFn(getEngagementReport);
  const { data, isLoading } = useQuery({
    queryKey: ["engagement-report"],
    queryFn: () => fetchEngagement(),
  });

  const rows = useMemo(() => {
    return [...(data ?? [])]
      .filter((r) => r.workouts30d === 0 || r.score < 30)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  }, [data]);

  return (
    <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight">Members needing attention</h2>
          <p className="text-xs text-muted-foreground">Lowest 30-day engagement in your gym</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="rounded-lg">
          <Link to="/admin/reports/engagement">View all</Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-16 rounded-2xl" /></div>
      ) : !rows.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Everyone is engaged right now — nothing to chase.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r: EngagementRow) => {
            const name = r.displayName ?? r.email;
            return (
              <div key={r.memberId} className="card-lift flex items-center gap-4 rounded-2xl border border-border p-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-semibold text-primary">
                  {name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary-soft px-2 py-0.5 text-[10px] font-semibold text-secondary">
                      <AlertTriangle className="h-3 w-3" /> Score {r.score}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.workouts30d} workouts · {r.checkIns30d} check-ins · {r.messages30d} messages (30d)
                  </p>
                </div>
                <Button asChild size="sm" className="rounded-lg">
                  <Link to="/admin/members/$memberId" params={{ memberId: r.memberId }}>Open</Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Real recorded membership payments. Admin-only. */
function PaymentHistory() {
  const fetchPayments = useServerFn(getRecentPayments);
  const { data, isLoading } = useQuery({
    queryKey: ["recent-payments"],
    queryFn: () => fetchPayments(),
  });

  return (
    <div className="rounded-[2rem] border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h2 className="text-base font-bold tracking-tight">Payment history</h2>
          <p className="text-xs text-muted-foreground">Last 5 recorded payments</p>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2 px-6 pb-6"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
      ) : !(data ?? []).length ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-4 pl-6 font-medium">Member</th>
              <th className="py-4 font-medium">Cycle</th>
              <th className="py-4 font-medium">Amount</th>
              <th className="py-4 font-medium">Date</th>
              <th className="py-4 pr-6 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((p: PaymentRow) => (
              <tr key={p.memberId}>
                <td className="py-4 pl-6 font-medium">{p.name}</td>
                <td className="py-4 capitalize text-muted-foreground">{p.billingCycle ?? "—"}</td>
                <td className="py-4 font-numeric font-semibold">
                  {p.amount === null ? "—" : p.amount.toLocaleString()}
                </td>
                <td className="py-4 text-muted-foreground">
                  {p.date ? new Date(p.date).toLocaleDateString() : "—"}
                </td>
                <td className="py-4 pr-6">
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      p.confirmed ? "bg-primary-soft text-primary" : "bg-secondary-soft text-secondary",
                    ].join(" ")}
                  >
                    {p.confirmed ? "Paid" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
