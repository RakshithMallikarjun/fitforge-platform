import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Dumbbell, Flame, MessageSquareQuote, Play, QrCode, Sparkles, TrendingUp } from "lucide-react";
import { BentoStatCard } from "@/components/bento-stat-card";
import { Button } from "@/components/ui/button";
import { getMemberHome } from "@/lib/member-home.functions";

export const Route = createFileRoute("/_authenticated/app/")({
  component: MemberHome,
});

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MemberHome() {
  const fetchHome = useServerFn(getMemberHome);
  const { data, isLoading } = useQuery({
    queryKey: ["member-home"],
    queryFn: () => fetchHome(),
  });

  const name = (data?.displayName ?? "").split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          Hey {name} — ready to train?
        </h1>
      </div>

      {/* Workout of the day hero */}
      <WorkoutOfTheDay data={data} isLoading={isLoading} />

      <div className="grid grid-cols-2 gap-3">
        <BentoStatCard
          label="Streak"
          value={isLoading ? "—" : `${data?.streakDays ?? 0} day${(data?.streakDays ?? 0) === 1 ? "" : "s"}`}
          footer={
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {(data?.streakDays ?? 0) > 0 ? "Keep it going" : "Start today"}
            </span>
          }
        />
        <BentoStatCard
          label="This week"
          value={isLoading ? "—" : `${data?.weekCompleted ?? 0} / ${data?.weekTarget ?? 4}`}
          footer={
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {(data?.weekCompleted ?? 0) >= (data?.weekTarget ?? 4) ? "Goal hit" : "On track"}
            </span>
          }
        />
      </div>

      {/* Last workout */}
      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Last session</p>
          <span className="text-xs font-medium text-foreground">
            {formatRelative(data?.lastWorkoutDate ?? null)}
          </span>
        </div>
        <p className="mt-2 text-base font-semibold tracking-tight">
          {data?.lastWorkoutDate ? "Logged and counted toward your streak." : "No workouts logged yet — your journey starts here."}
        </p>
      </div>

      {/* Latest trainer note */}
      {data?.latestNote && (
        <div className="rounded-[2rem] border border-border bg-secondary-soft p-5">
          <div className="flex items-center gap-2 text-secondary">
            <MessageSquareQuote className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.15em]">
              From {data.latestNote.author ?? "your trainer"}
            </p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{data.latestNote.body}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{formatRelative(data.latestNote.created_at)}</p>
        </div>
      )}
    </div>
  );
}

function WorkoutOfTheDay({
  data,
  isLoading,
}: {
  data: Awaited<ReturnType<typeof getMemberHome>> | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="bento-emerald animate-pulse">
        <div className="h-3 w-24 rounded bg-white/20" />
        <div className="mt-3 h-6 w-40 rounded bg-white/20" />
      </div>
    );
  }

  const next = data?.nextWorkout;
  if (!next) {
    return (
      <div className="bento-emerald">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/70">
          Workout of the day
        </p>
        <p className="font-numeric mt-2 text-xl font-bold">No active plan yet</p>
        <p className="mt-1 text-xs text-primary-foreground/70">
          Your trainer will assign one shortly. Check back soon.
        </p>
        <Button variant="secondary" size="sm" disabled className="mt-5 rounded-lg opacity-70">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Awaiting plan
        </Button>
      </div>
    );
  }

  const navigate = useNavigate();
  return (
    <div className="bento-emerald">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/70">
        Workout of the day
      </p>
      <p className="font-numeric mt-2 text-2xl font-bold leading-tight">{next.dayLabel}</p>
      {next.muscleGroups.length > 0 && (
        <p className="mt-1 text-xs capitalize text-primary-foreground/70">
          {next.muscleGroups.join(" · ")}
        </p>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-primary-foreground/80">
        <span className="inline-flex items-center gap-1">
          <Dumbbell className="h-3.5 w-3.5" /> {next.exerciseCount} exercises
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> ~{next.estimatedMinutes} min
        </span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="mt-5 rounded-lg"
        onClick={() => navigate({ to: "/app/workout/$dayId", params: { dayId: next.dayId } })}
      >
        <Play className="mr-1.5 h-3.5 w-3.5" />
        Start workout
      </Button>
    </div>
  );
}
