import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Dumbbell, ChevronRight, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkoutsBrowser } from "@/lib/workout-player.functions";

export const Route = createFileRoute("/_authenticated/app/workouts")({
  component: WorkoutsPage,
});

function WorkoutsPage() {
  const fn = useServerFn(getWorkoutsBrowser);
  const { data, isLoading } = useQuery({
    queryKey: ["workouts-browser"],
    queryFn: () => fn(),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Workouts</h1>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-[2rem]" />
          <Skeleton className="h-24 rounded-[2rem]" />
        </div>
      ) : data?.activePlan ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Active plan</p>
            <p className="text-xs font-medium">{data.activePlan.name}</p>
          </div>
          {data.activePlan.days.map((d) => (
            <Link
              key={d.id}
              to="/app/workout/$dayId"
              params={{ dayId: d.id }}
              className="card-lift block rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold tracking-tight">{d.day_label}</p>
                  {d.muscleGroups.length > 0 && (
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {d.muscleGroups.join(" · ")}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Dumbbell className="h-3.5 w-3.5" /> {d.exerciseCount} exercises
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> ~{d.estimatedMinutes} min
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="rounded-[2rem] border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
            <Dumbbell className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-semibold tracking-tight">No plan yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your trainer hasn't assigned a plan yet.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Past workouts</p>
        {isLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : data && data.pastWorkouts.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {data.pastWorkouts.map((p, i) => (
              <div
                key={p.id}
                className={[
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 ? "border-t border-border" : "",
                ].join(" ")}
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary">
                  <History className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold tracking-tight truncate">
                    {p.day_label ?? "Workout"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                {p.effort_rating != null && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary">
                    {p.effort_rating}/10
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No completed sessions yet.</p>
        )}
      </section>
    </div>
  );
}
