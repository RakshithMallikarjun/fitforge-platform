import { createFileRoute } from "@tanstack/react-router";
import { Flame, Play, TrendingUp } from "lucide-react";
import { BentoStatCard } from "@/components/bento-stat-card";
import { TimelineItem } from "@/components/timeline-item";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/app/")({
  component: MemberHome,
});

function MemberHome() {
  const { data: user } = useCurrentUser();
  const name = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Today</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          Hey {name} — ready to train?
        </h1>
      </div>

      {/* hero workout card */}
      <div className="bento-emerald">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/70">
          Today's session
        </p>
        <p className="font-numeric mt-2 text-2xl font-bold">Upper Body · Push</p>
        <p className="mt-1 text-xs text-primary-foreground/70">6 exercises · ~45 min</p>
        <Button variant="secondary" size="sm" className="mt-5 rounded-lg">
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Start workout
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BentoStatCard label="Streak" value="12 days" footer={<span className="inline-flex items-center gap-1"><Flame className="h-3 w-3" /> Personal best</span>} />
        <BentoStatCard label="This week" value="3 / 4" footer={<span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> On track</span>} />
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-bold tracking-tight">This week</h3>
        <div className="mt-4 space-y-1">
          <TimelineItem timestamp="Mon" title="Upper · Push" subtitle="Completed" variant="muted" />
          <TimelineItem timestamp="Wed" title="Lower · Squat focus" subtitle="Completed" variant="muted" />
          <TimelineItem timestamp="Today" title="Upper · Push" subtitle="6 exercises" />
          <TimelineItem timestamp="Fri" title="Conditioning" subtitle="30 min" variant="sky" />
        </div>
      </div>
    </div>
  );
}
