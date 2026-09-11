import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Dumbbell, ChevronRight, History, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDayDate } from "@/lib/format-date";
import {
  getWorkoutsBrowser,
  getSessionSummary,
  listPastWorkouts,
} from "@/lib/workout-player.functions";

export const Route = createFileRoute("/_authenticated/app/workouts")({
  component: WorkoutsPage,
});

const PAGE_SIZE = 10;

function WorkoutsPage() {
  const fn = useServerFn(getWorkoutsBrowser);
  const fetchPast = useServerFn(listPastWorkouts);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["workouts-browser"],
    queryFn: () => fn(),
  });
  const past = useInfiniteQuery({
    queryKey: ["past-workouts"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchPast({ data: { offset: pageParam as number, limit: PAGE_SIZE } }),
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * PAGE_SIZE : undefined),
  });
  const pastRows = past.data?.pages.flatMap((p) => p.rows) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Workouts</h1>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-[2rem]" />
          <Skeleton className="h-24 rounded-[2rem]" />
        </div>
      ) : data?.activePlan ? (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Active plan</p>
            <p className="text-xs font-medium">{data.activePlan.name}</p>
          </div>
          {(() => {
            const meta: Record<string, { label: string; emoji: string; badgeClass: string }> = {
              warmup: {
                label: "Warm-Up",
                emoji: "🔥",
                badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
              },
              main: {
                label: "Main Workout",
                emoji: "💪",
                badgeClass: "bg-primary/15 text-primary",
              },
              cooldown: {
                label: "Cooldown",
                emoji: "🧘",
                badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
              },
            };
            const order: Array<"warmup" | "main" | "cooldown"> = ["warmup", "main", "cooldown"];
            const groups = order
              .map((bt) => ({
                bt,
                days: data.activePlan!.days.filter((d) => (d.block_type ?? "main") === bt),
              }))
              .filter((g) => g.days.length > 0);
            const hasSections = groups.length > 1;
            return groups.map((g) => (
              <div key={g.bt} className="space-y-3">
                {hasSections && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta[g.bt].badgeClass}`}
                    >
                      <span>{meta[g.bt].emoji}</span> {meta[g.bt].label}
                    </span>
                  </div>
                )}
                {g.days.map((d) => (
                  <Link
                    key={d.id}
                    to="/app/workout/$dayId"
                    params={{ dayId: d.id }}
                    className="card-lift block rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-base font-bold tracking-tight">
                          {d.day_label}
                        </p>
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
              </div>
            ));
          })()}
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
        {past.isLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : pastRows.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {pastRows.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOpenSession(p.id)}
                  className={[
                    "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50",
                    i > 0 ? "border-t border-border" : "",
                  ].join(" ")}
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight">
                      {p.day_label ?? "Workout"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDayDate(p.date)}</p>
                  </div>
                  {p.effort_rating != null && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary">
                      {p.effort_rating}/10
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            {past.hasNextPage && (
              <Button
                variant="outline"
                className="w-full rounded-xl"
                disabled={past.isFetchingNextPage}
                onClick={() => past.fetchNextPage()}
              >
                {past.isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading…
                  </>
                ) : (
                  "Show more"
                )}
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No completed sessions yet.</p>
        )}
      </section>

      <SessionSummaryDialog logId={openSession} onClose={() => setOpenSession(null)} />
    </div>
  );
}

function SessionSummaryDialog({ logId, onClose }: { logId: string | null; onClose: () => void }) {
  const fetchSummary = useServerFn(getSessionSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["session-summary", logId],
    queryFn: () => fetchSummary({ data: { logId: logId! } }),
    enabled: !!logId,
  });

  return (
    <Dialog open={!!logId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data?.day_label ?? "Session"}
            {data?.date ? ` — ${formatDayDate(data.date)}` : ""}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">We couldn't find that session.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {data.effort_rating != null && (
                <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-primary">
                  Effort {data.effort_rating}/10
                </span>
              )}
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {data.exercises.length} exercise{data.exercises.length === 1 ? "" : "s"}
              </span>
            </div>
            {data.exercises.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sets were logged in this session.</p>
            ) : (
              <ul className="space-y-3">
                {data.exercises.map((ex) => (
                  <li key={ex.exercise_id} className="rounded-xl border border-border p-3">
                    <p className="text-sm font-semibold tracking-tight">{ex.name}</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {ex.sets.map((st) => (
                        <li
                          key={st.set_number}
                          className="flex items-center justify-between text-xs text-muted-foreground"
                        >
                          <span>Set {st.set_number}</span>
                          <span className={st.completed ? "text-foreground" : ""}>
                            {st.weight != null ? `${st.weight} kg` : "—"} ×{" "}
                            {st.reps != null ? st.reps : "—"}
                            {!st.completed ? " (skipped)" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {data.notes && (
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm">{data.notes}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
