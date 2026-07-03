import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ArrowUpRight, Calendar, LifeBuoy } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { BentoStatCard } from "@/components/bento-stat-card";
import { TimelineItem } from "@/components/timeline-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getAdminStats, getTrainerStats, type TrainerStat } from "@/lib/admin-stats.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: user } = useCurrentUser();
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
            {/* Engagement requests */}
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Engagement requests</h2>
                  <p className="text-xs text-muted-foreground">New members and unanswered messages</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-lg">View all</Button>
              </div>
              <div className="space-y-3">
                {[
                  { name: "Alex Rivera", note: "Wants a strength plan", tag: "New patient" },
                  { name: "Jordan Lee", note: "Asked about nutrition coaching", tag: "Follow-up" },
                  { name: "Priya Shah", note: "Onboarding pending", tag: "New patient" },
                ].map((r) => (
                  <div key={r.name} className="card-lift flex items-center gap-4 rounded-2xl border border-border p-4">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-semibold text-primary">
                      {r.name.split(" ").map((p) => p[0]).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{r.name}</p>
                        <span className="rounded-full bg-secondary-soft px-2 py-0.5 text-[10px] font-semibold text-secondary">
                          {r.tag}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="rounded-lg">Skip</Button>
                      <Button size="sm" className="rounded-lg">Open</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment history */}
            <div className="rounded-[2rem] border border-border bg-card shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between p-6 pb-4">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Payment history</h2>
                  <p className="text-xs text-muted-foreground">Last 5 transactions</p>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-4 pl-6 font-medium">Member</th>
                    <th className="py-4 font-medium">Plan</th>
                    <th className="py-4 font-medium">Amount</th>
                    <th className="py-4 pr-6 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Alex Rivera", "Monthly", "$89", "Disbursed"],
                    ["Jordan Lee", "Annual", "$899", "Disbursed"],
                    ["Priya Shah", "Monthly", "$89", "Pending"],
                    ["Sam Chen", "PT pack", "$240", "Disbursed"],
                    ["Maya Park", "Monthly", "$89", "Disbursed"],
                  ].map(([name, plan, amount, status]) => (
                    <tr key={name as string}>
                      <td className="py-4 pl-6 font-medium">{name}</td>
                      <td className="py-4 text-muted-foreground">{plan}</td>
                      <td className="py-4 font-numeric font-semibold">{amount}</td>
                      <td className="py-4 pr-6">
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            status === "Disbursed"
                              ? "bg-primary-soft text-primary"
                              : "bg-secondary-soft text-secondary",
                          ].join(" ")}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side widgets */}
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold tracking-tight">Today's schedule</h3>
              </div>
              <div className="space-y-1">
                <TimelineItem timestamp="08:00 AM" title="Strength · Alex Rivera" subtitle="With Coach Maya" />
                <TimelineItem timestamp="10:30 AM" title="Assessment · Jordan Lee" subtitle="Body comp + VO₂" variant="sky" />
                <TimelineItem timestamp="12:00 PM" title="Open block" subtitle="No sessions booked" variant="muted" />
                <TimelineItem timestamp="04:00 PM" title="Conditioning · Priya Shah" />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] bg-[oklch(0.28_0.07_232)] p-6 text-primary-foreground">
              <LifeBuoy className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5" />
              <h3 className="text-base font-bold tracking-tight">Need a hand?</h3>
              <p className="mt-1 text-xs text-white/80">
                Our team is on call 9–6 to help you launch your member app.
              </p>
              <Button variant="secondary" size="sm" className="mt-4 rounded-lg">
                Talk to support
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
