import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  PartyPopper,
  Play,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  completeWorkout,
  getPreviousSetValues,
  getWorkoutDay,
  logSet,
  startWorkoutLog,
  type NewPR,
  type PrevSet,
  type WorkoutDayData,
  type WorkoutDayExercise,
} from "@/lib/workout-player.functions";
import { enqueueLog } from "@/lib/pwa/offline-queue";

function isOfflineError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String((e as any)?.message ?? e ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("offline")
  );
}

export const Route = createFileRoute("/_authenticated/app/workout/$dayId")({
  component: WorkoutPlayer,
});

type SetState = { weight: string; reps: string; done: boolean };

function WorkoutPlayer() {
  const { dayId } = Route.useParams();
  const navigate = useNavigate();

  const fetchDay = useServerFn(getWorkoutDay);
  const startLog = useServerFn(startWorkoutLog);
  const logOneSet = useServerFn(logSet);
  const finishWorkout = useServerFn(completeWorkout);
  const fetchPrev = useServerFn(getPreviousSetValues);

  const cacheKey = `fitforge:day:${dayId}`;
  const [offlineFallback, setOfflineFallback] = useState(false);

  const { data: dayData, isLoading } = useQuery({
    queryKey: ["workout-day", dayId],
    queryFn: async (): Promise<WorkoutDayData> => {
      try {
        const fresh = await fetchDay({ data: { dayId } });
        // Cache for offline
        void idbSet(cacheKey, fresh).catch(() => {});
        setOfflineFallback(false);
        return fresh;
      } catch (err) {
        const cached = await idbGet<WorkoutDayData>(cacheKey).catch(() => null);
        if (cached) {
          setOfflineFallback(true);
          return cached;
        }
        throw err;
      }
    },
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [logId, setLogId] = useState<string | null>(null);
  const [sets, setSets] = useState<Record<string, SetState[]>>({});
  const [phase, setPhase] = useState<"playing" | "complete">("playing");
  const [notes, setNotes] = useState("");
  const [effort, setEffort] = useState<number | null>(null);
  const [newPRs, setNewPRs] = useState<NewPR[]>([]);
  const [finished, setFinished] = useState(false);

  // Start a log as soon as the day loads.
  useEffect(() => {
    if (!dayData || logId) return;
    startLog({
      data: { planId: dayData.plan?.id ?? null, workoutDayId: dayData.day.id },
    })
      .then((r) => setLogId(r.logId))
      .catch((e) => toast.error("Could not start session", { description: e?.message }));
  }, [dayData, logId, startLog]);

  // Seed empty set rows whenever exercises arrive.
  useEffect(() => {
    if (!dayData) return;
    setSets((cur) => {
      if (Object.keys(cur).length) return cur;
      const next: Record<string, SetState[]> = {};
      for (const ex of dayData.exercises) {
        next[ex.id] = Array.from({ length: ex.sets }, () => ({ weight: "", reps: "", done: false }));
      }
      return next;
    });
  }, [dayData]);

  const exercises = dayData?.exercises ?? [];
  const current = exercises[currentIdx];

  // Fetch previous set values per exercise (parallel).
  const prevQueries = useQueries({
    queries: exercises.map((ex) => ({
      queryKey: ["prev-sets", ex.exercise.id],
      queryFn: () => fetchPrev({ data: { exerciseId: ex.exercise.id } }),
      staleTime: 5 * 60_000,
    })),
  });

  const prevMap = useMemo(() => {
    const m = new Map<string, PrevSet[]>();
    exercises.forEach((ex, i) => {
      m.set(ex.exercise.id, (prevQueries[i]?.data as PrevSet[]) ?? []);
    });
    return m;
  }, [exercises, prevQueries]);

  // Pre-fill empty rows with previous values when available.
  useEffect(() => {
    if (!current) return;
    const prev = prevMap.get(current.exercise.id) ?? [];
    if (!prev.length) return;
    setSets((cur) => {
      const rows = cur[current.id];
      if (!rows) return cur;
      let changed = false;
      const next = rows.map((row, idx) => {
        if (row.weight || row.reps || row.done) return row;
        const p = prev.find((x) => x.set_number === idx + 1) ?? prev[idx];
        if (!p) return row;
        changed = true;
        return {
          ...row,
          weight: p.weight != null ? String(p.weight) : "",
          reps: p.reps != null ? String(p.reps) : "",
        };
      });
      if (!changed) return cur;
      return { ...cur, [current.id]: next };
    });
  }, [current, prevMap]);

  const logSetMut = useMutation({
    mutationFn: async (input: {
      exerciseId: string;
      setNumber: number;
      weight: number | null;
      reps: number | null;
      completed: boolean;
    }) => {
      const payload = {
        logId: logId!,
        exerciseId: input.exerciseId,
        setNumber: input.setNumber,
        weight: input.weight,
        reps: input.reps,
        completed: input.completed,
      };
      try {
        return await logOneSet({ data: payload });
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueueLog("logSet", payload);
          toast.info("Saved offline — will sync when reconnected.");
          return { queued: true } as any;
        }
        throw err;
      }
    },
    onError: (e: any) => toast.error("Could not save set", { description: e?.message }),
  });

  const completeMut = useMutation({
    mutationFn: async () => {
      const payload = {
        logId: logId!,
        notes: notes.trim() || null,
        effortRating: effort,
      };
      try {
        return await finishWorkout({ data: payload });
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueueLog("completeWorkout", { ...payload, synced_offline: true });
          toast.info("Session saved offline — will sync when reconnected.");
          return { ok: true, newPRs: [] as NewPR[], queued: true } as any;
        }
        throw err;
      }
    },
    onSuccess: (res: any) => {
      const prs: NewPR[] = res?.newPRs ?? [];
      setNewPRs(prs);
      setFinished(true);
      if (prs.length > 0) {
        toast.success(`🏆 ${prs.length} new PR${prs.length > 1 ? "s" : ""}!`);
      } else {
        toast.success("Workout logged. Great work.");
      }
    },
    onError: (e: any) => toast.error("Could not finish", { description: e?.message }),
  });

  function updateSet(exId: string, idx: number, patch: Partial<SetState>) {
    setSets((cur) => {
      const rows = cur[exId] ?? [];
      const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      return { ...cur, [exId]: next };
    });
  }

  function toggleSetDone(ex: WorkoutDayExercise, idx: number) {
    const row = sets[ex.id]?.[idx];
    if (!row || !logId) return;
    const newDone = !row.done;
    updateSet(ex.id, idx, { done: newDone });
    logSetMut.mutate({
      exerciseId: ex.exercise.id,
      setNumber: idx + 1,
      weight: row.weight ? Number(row.weight) : null,
      reps: row.reps ? Number(row.reps) : null,
      completed: newDone,
    });
    if (newDone && ex.rest_seconds > 0) {
      startTimer(ex.rest_seconds);
    }
  }

  // Rest timer
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [timerTotal, setTimerTotal] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);
  function startTimer(seconds: number) {
    setTimerTotal(seconds);
    setTimerLeft(seconds);
  }
  function stopTimer() {
    setTimerLeft(null);
  }
  useEffect(() => {
    if (timerLeft == null) return;
    intervalRef.current = window.setInterval(() => {
      setTimerLeft((l) => {
        if (l == null) return null;
        if (l <= 1) {
          window.clearInterval(intervalRef.current!);
          return null;
        }
        return l - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [timerLeft != null ? "on" : "off"]);

  if (isLoading || !dayData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 rounded-[2rem]" />
        <Skeleton className="h-40 rounded-[2rem]" />
      </div>
    );
  }

  if (!exercises.length) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/workouts" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="rounded-[2rem] border border-border bg-card p-8 text-center">
          <p className="text-sm font-semibold">No exercises in this day yet.</p>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return <CompletionScreen
      notes={notes}
      setNotes={setNotes}
      effort={effort}
      setEffort={setEffort}
      onFinish={() => completeMut.mutate()}
      submitting={completeMut.isPending}
      finished={finished}
      newPRs={newPRs}
      onDone={() => navigate({ to: "/app" })}
    />;
  }

  const ex = current!;
  const rows = sets[ex.id] ?? [];
  const prev = prevMap.get(ex.exercise.id) ?? [];

  return (
    <div className="space-y-5 pb-8">
      {offlineFallback && (
        <div className="flex items-center gap-2 rounded-2xl border border-secondary/30 bg-secondary-soft px-3 py-2 text-xs text-secondary">
          <CloudOff className="h-3.5 w-3.5" />
          Offline mode — sets will sync when you're back online.
        </div>
      )}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/app/workouts" })}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Exercise {currentIdx + 1} of {exercises.length}
        </p>
        <div className="w-9" />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((currentIdx + 1) / exercises.length) * 100}%` }}
        />
      </div>

      {/* Exercise hero */}
      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        {ex.exercise.thumbnail_url ? (
          <a
            href={ex.exercise.video_url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="relative block aspect-video overflow-hidden rounded-2xl bg-muted"
          >
            <img
              src={ex.exercise.thumbnail_url}
              alt={ex.exercise.name}
              className="h-full w-full object-cover"
            />
            {ex.exercise.video_url && (
              <span className="absolute inset-0 grid place-items-center bg-black/30 text-white">
                <Play className="h-8 w-8" />
              </span>
            )}
          </a>
        ) : (
          <div className="grid aspect-video place-items-center rounded-2xl bg-accent text-primary">
            <Sparkles className="h-8 w-8" />
          </div>
        )}
        {(() => {
          const bt = dayData.day.block_type ?? "main";
          const meta = {
            warmup: { label: "Warm-Up", emoji: "🔥", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
            main: { label: "Main Workout", emoji: "💪", cls: "bg-primary/15 text-primary" },
            cooldown: { label: "Cooldown", emoji: "🧘", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
          }[bt];
          return (
            <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
              <span>{meta.emoji}</span> {meta.label}
            </span>
          );
        })()}
        <h2 className="mt-2 font-display text-xl font-bold tracking-tight">{ex.exercise.name}</h2>
        {ex.exercise.muscle_groups.length > 0 && (
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">
            {ex.exercise.muscle_groups.join(" · ")}
          </p>
        )}
        <p className="mt-2 text-xs font-medium text-foreground">
          {ex.sets} sets {ex.reps ? `× ${ex.reps} reps` : ""} · rest {ex.rest_seconds}s
        </p>
        {ex.notes && (
          <p className="mt-3 rounded-2xl bg-secondary-soft p-3 text-xs leading-relaxed text-secondary">
            {ex.notes}
          </p>
        )}
        {ex.exercise.video_url && (
          <p className="mt-2 break-all text-[11px] text-muted-foreground">
            Video: {ex.exercise.video_url}
          </p>
        )}
      </div>

      {/* Set logger */}
      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Log your sets</p>
        <div className="mt-3 space-y-2">
          {rows.map((row, idx) => {
            const p = prev.find((x) => x.set_number === idx + 1) ?? prev[idx];
            const placeholder = p
              ? `prev: ${p.weight ?? "—"} kg × ${p.reps ?? "—"}`
              : "—";
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-7 text-center text-xs font-semibold text-muted-foreground">
                  {idx + 1}
                </span>
                <Input
                  inputMode="decimal"
                  className="rounded-xl"
                  placeholder={p?.weight != null ? String(p.weight) : "kg"}
                  value={row.weight}
                  onChange={(e) => updateSet(ex.id, idx, { weight: e.target.value })}
                />
                <span className="text-xs text-muted-foreground">kg</span>
                <Input
                  inputMode="numeric"
                  className="rounded-xl"
                  placeholder={p?.reps != null ? String(p.reps) : "reps"}
                  value={row.reps}
                  onChange={(e) => updateSet(ex.id, idx, { reps: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => toggleSetDone(ex, idx)}
                  aria-label={row.done ? "Mark set undone" : "Mark set done"}
                  className={[
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors",
                    row.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
        {prev.length === 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">No previous data — this is your baseline.</p>
        )}
        {prev.length > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">{`Hint: ${prev
            .slice(0, 3)
            .map((p) => `S${p.set_number} ${p.weight ?? "—"}×${p.reps ?? "—"}`)
            .join(" · ")}`}</p>
        )}
      </div>

      {/* Rest timer */}
      {timerLeft != null && (
        <RestTimer total={timerTotal} left={timerLeft} onSkip={stopTimer} />
      )}

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          className="flex-1 rounded-xl"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        {currentIdx === exercises.length - 1 ? (
          <Button className="flex-1 rounded-xl" onClick={() => setPhase("complete")}>
            Finish <PartyPopper className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="flex-1 rounded-xl"
            onClick={() => setCurrentIdx((i) => Math.min(exercises.length - 1, i + 1))}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function RestTimer({ total, left, onSkip }: { total: number; left: number; onSkip: () => void }) {
  const pct = total > 0 ? (1 - left / total) * 100 : 100;
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div className="fixed inset-x-0 bottom-24 z-20 px-5">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-2xl border border-border bg-card/95 p-3 shadow-[var(--shadow-card)] backdrop-blur">
        <div className="flex items-center gap-3">
          <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
            <circle cx="34" cy="34" r={r} stroke="currentColor" strokeWidth="6" className="text-muted" fill="none" />
            <circle
              cx="34"
              cy="34"
              r={r}
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className="text-primary transition-[stroke-dashoffset] duration-1000"
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </svg>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Rest</p>
            <p className="font-numeric text-xl font-bold">{left}s</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={onSkip}>
          <SkipForward className="mr-1 h-4 w-4" /> Skip
        </Button>
      </div>
    </div>
  );
}

function CompletionScreen({
  notes,
  setNotes,
  effort,
  setEffort,
  onFinish,
  submitting,
  finished,
  newPRs,
  onDone,
}: {
  notes: string;
  setNotes: (v: string) => void;
  effort: number | null;
  setEffort: (n: number) => void;
  onFinish: () => void;
  submitting: boolean;
  finished: boolean;
  newPRs: NewPR[];
  onDone: () => void;
}) {
  return (
    <div className="space-y-5 pb-8 animate-fade-in">
      <div className="bento-emerald text-center">
        <div className="mx-auto grid h-16 w-16 animate-scale-in place-items-center rounded-full bg-white/15">
          <Check className="h-8 w-8 text-primary-foreground" />
        </div>
        <p className="mt-4 font-display text-2xl font-bold">Workout Complete</p>
        <p className="mt-1 text-xs text-primary-foreground/80">
          {finished ? "Nice session — your log is saved." : "Log your effort and notes below."}
        </p>
      </div>

      {finished && newPRs.length > 0 && (
        <div className="rounded-[2rem] border border-primary/30 bg-primary/5 p-5 shadow-[var(--shadow-card)] animate-scale-in">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <p className="font-display text-lg font-bold tracking-tight">New Personal Records!</p>
          </div>
          <ul className="mt-3 space-y-2">
            {newPRs.map((pr, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-2">
                <span className="text-sm font-semibold">{pr.exerciseName}</span>
                <span className="font-numeric text-sm font-bold text-primary">
                  {pr.weight} kg{pr.reps ? ` × ${pr.reps}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!finished && (
        <>
          <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Effort rating</p>
            <div className="mt-3 grid grid-cols-10 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEffort(n)}
                  className={[
                    "grid aspect-square place-items-center rounded-lg border text-sm font-semibold transition-colors",
                    effort === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Session notes</p>
            <Textarea
              rows={4}
              className="mt-3 rounded-2xl"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel? Any PRs?"
            />
          </div>
        </>
      )}

      {finished ? (
        <Button className="w-full rounded-xl" onClick={onDone}>
          Done
        </Button>
      ) : (
        <Button className="w-full rounded-xl" onClick={onFinish} disabled={submitting}>
          {submitting ? "Saving…" : "Finish workout"}
        </Button>
      )}
    </div>
  );
}
