import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO, isWithinInterval } from "date-fns";
import { TrendingUp, Plus, Trash2, Trophy, Target, Dumbbell, Activity } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getProgressData, createGoal, deleteGoal, getFitnessScore,
  type ProgressData, type FitnessScore,
} from "@/lib/progress.functions";

export const Route = createFileRoute("/_authenticated/app/progress")({
  component: ProgressPage,
});

function ProgressPage() {
  const fetchFn = useServerFn(getProgressData);
  const fetchScoreFn = useServerFn(getFitnessScore);
  const { data, isLoading } = useQuery({
    queryKey: ["progress-data"],
    queryFn: () => fetchFn(),
  });
  const { data: fitnessScore } = useQuery({
    queryKey: ["fitness-score"],
    queryFn: () => fetchScoreFn(),
  });

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-secondary-soft text-secondary">
          <TrendingUp className="h-5 w-5" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Progress</h1>
      </div>

      {fitnessScore && <FitnessScoreCard score={fitnessScore} />}

      <Tabs defaultValue="body" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="strength">Strength</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="mt-4">
          {isLoading ? <SkeletonCard /> : <BodyTab data={data!} />}
        </TabsContent>
        <TabsContent value="strength" className="mt-4">
          {isLoading ? <SkeletonCard /> : <StrengthTab data={data!} />}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          {isLoading ? <SkeletonCard /> : <HistoryTab data={data!} />}
        </TabsContent>
        <TabsContent value="goals" className="mt-4">
          {isLoading ? <SkeletonCard /> : <GoalsTab data={data!} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- FITNESS SCORE CARD ---------------- */


function FitnessScoreCard({ score }: { score: FitnessScore }) {
  if (!score.hasAssessment || score.score == null) {
    return (
      <div className="rounded-[2rem] border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold">Fitness Score</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Complete your first fitness assessment with your trainer to unlock your score.
        </p>
      </div>
    );
  }
  const s = score.score;
  const barColor =
    s < 40 ? "bg-red-500" :
    s < 70 ? "bg-amber-500" :
    s < 90 ? "bg-green-500" : "bg-yellow-400";
  const trendEl =
    score.trend == null ? (
      <span className="text-xs text-muted-foreground">First assessment</span>
    ) : score.trend > 0 ? (
      <span className="text-xs font-semibold text-green-600">↑ +{score.trend}</span>
    ) : score.trend < 0 ? (
      <span className="text-xs font-semibold text-red-600">↓ {score.trend}</span>
    ) : (
      <span className="text-xs text-muted-foreground">No change</span>
    );

  return (
    <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fitness Score</p>
        {trendEl}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="font-numeric text-5xl font-bold tracking-tight">{s}</p>
        <p className="text-sm font-semibold text-muted-foreground">{score.label}</p>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${s}%` }} />
      </div>
    </div>
  );
}

function _SkeletonCard() {
  return <div className="h-40 animate-pulse rounded-[2rem] bg-muted" />;
}

function EmptyCard({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="rounded-[2rem] border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary-soft text-secondary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-semibold tracking-tight">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/* ---------------- BODY TAB ---------------- */

function BodyTab({ data }: { data: ProgressData }) {
  const [measure, setMeasure] = useState<"waist" | "chest" | "hips">("waist");
  const assessments = data.assessments;

  if (assessments.length < 2) {
    return (
      <EmptyCard
        icon={Activity}
        title="No assessment data yet"
        subtitle="Your trainer will record measurements over time to unlock progress charts."
      />
    );
  }

  const latest = assessments[assessments.length - 1];
  const chartData = assessments.map((a) => ({
    date: format(parseISO(a.date), "MMM d"),
    weight: a.weight,
    body_fat_pct: a.body_fat_pct,
    waist: a.waist,
    chest: a.chest,
    hips: a.hips,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Latest snapshot · {format(parseISO(latest.date), "PPP")}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Metric label="Weight" value={latest.weight} unit={latest.unit_system === "imperial" ? "lb" : "kg"} />
          <Metric label="Body fat" value={latest.body_fat_pct} unit="%" />
          <Metric label="Muscle" value={latest.muscle_mass} unit={latest.unit_system === "imperial" ? "lb" : "kg"} />
        </div>
      </div>

      <ChartCard title="Weight" dataKey="weight" data={chartData} color="hsl(var(--primary))" />
      <ChartCard title="Body fat %" dataKey="body_fat_pct" data={chartData} color="hsl(var(--secondary))" />

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Measurements</h3>
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {(["waist", "chest", "hips"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMeasure(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                  measure === m ? "bg-background shadow" : "text-muted-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey={measure} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">
        {value != null ? value : "—"}
        {value != null && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

function ChartCard({ title, dataKey, data, color }: any) {
  return (
    <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------------- STRENGTH TAB ---------------- */

function epley(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

function StrengthTab({ data }: { data: ProgressData }) {
  const logs = data.exerciseLogs;
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const uniqueExercises = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.weight && l.reps) map.set(l.exercise_id, l.exercise_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  const activeExerciseId = selectedExercise ?? uniqueExercises[0]?.id;

  const oneRmData = useMemo(() => {
    if (!activeExerciseId) return [];
    const byDate = new Map<string, number>();
    logs
      .filter((l) => l.exercise_id === activeExerciseId && l.weight && l.reps)
      .forEach((l) => {
        const est = epley(l.weight!, l.reps!);
        const prev = byDate.get(l.date) ?? 0;
        if (est > prev) byDate.set(l.date, est);
      });
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, val]) => ({ date: format(parseISO(date), "MMM d"), oneRm: Math.round(val) }));
  }, [logs, activeExerciseId]);

  const topVolume = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const volumes = new Map<string, { name: string; volume: number }>();
    logs.forEach((l) => {
      if (!l.date || !l.weight || !l.reps) return;
      if (parseISO(l.date) < cutoff) return;
      const cur = volumes.get(l.exercise_id) ?? { name: l.exercise_name, volume: 0 };
      cur.volume += l.weight * l.reps;
      volumes.set(l.exercise_id, cur);
    });
    return Array.from(volumes.values()).sort((a, b) => b.volume - a.volume).slice(0, 5);
  }, [logs]);

  const prs = useMemo(() => {
    const findMax = (keyword: string) => {
      let max = 0;
      logs.forEach((l) => {
        if (l.exercise_name.toLowerCase().includes(keyword) && l.weight && l.weight > max) {
          max = l.weight;
        }
      });
      return max || null;
    };
    const latest = data.assessments[data.assessments.length - 1];
    return [
      { lift: "Bench", logged: findMax("bench"), assessed: latest?.bench_1rm ?? null },
      { lift: "Squat", logged: findMax("squat"), assessed: latest?.squat_1rm ?? null },
      { lift: "Deadlift", logged: findMax("deadlift"), assessed: latest?.deadlift_1rm ?? null },
    ];
  }, [logs, data.assessments]);

  if (logs.length === 0) {
    return <EmptyCard icon={Dumbbell} title="No workout logs yet" subtitle="Complete a workout to see strength trends." />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Estimated 1RM</h3>
        </div>
        <div className="mt-2 -mx-1 flex gap-1.5 overflow-x-auto pb-2">
          {uniqueExercises.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedExercise(e.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                activeExerciseId === e.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>
        {oneRmData.length > 1 ? (
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={oneRmData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="oneRm" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-muted-foreground">Log more sessions to see the trend.</p>
        )}
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-semibold">Top volume (30 days)</h3>
        <div className="mt-3 space-y-2">
          {topVolume.length === 0 && <p className="text-xs text-muted-foreground">No volume in the last 30 days.</p>}
          {topVolume.map((t) => (
            <div key={t.name} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
              <span className="text-sm font-medium">{t.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{Math.round(t.volume).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Personal records</h3>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {prs.map((p) => (
            <div key={p.lift} className="rounded-2xl bg-primary/5 p-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{p.lift}</p>
              <p className="mt-1 text-lg font-bold">{p.logged ?? "—"}</p>
              {p.assessed != null && (
                <p className="text-[10px] text-muted-foreground">Trainer: {p.assessed}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- HISTORY TAB ---------------- */

function HistoryTab({ data }: { data: ProgressData }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const perPage = 20;

  const filtered = useMemo(() => {
    return data.history.filter((h) => {
      if (!from && !to) return true;
      const d = parseISO(h.date);
      const start = from ? parseISO(from) : new Date(0);
      const end = to ? parseISO(to) : new Date(8640000000000000);
      return isWithinInterval(d, { start, end });
    });
  }, [data.history, from, to]);

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  if (data.history.length === 0) {
    return <EmptyCard icon={Activity} title="No completed workouts yet" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-[2rem] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div>
          <Label htmlFor="from" className="text-xs">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        </div>
        <div>
          <Label htmlFor="to" className="text-xs">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        </div>
      </div>

      <div className="space-y-2">
        {paged.map((h) => (
          <div key={h.id} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{h.plan_name ?? "Workout"}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(h.date), "PPP")} · {h.day_label ?? "Session"} · {h.exercise_count} exercises
                </p>
              </div>
              {h.effort_rating != null && (
                <Badge variant="secondary" className="shrink-0">RPE {h.effort_rating}</Badge>
              )}
            </div>
            {h.notes && <p className="mt-2 text-xs text-muted-foreground">{h.notes}</p>}
          </div>
        ))}
        {paged.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No workouts in this range.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- GOALS TAB ---------------- */

function GoalsTab({ data }: { data: ProgressData }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createGoal);
  const deleteFn = useServerFn(deleteGoal);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("kg");
  const [targetDate, setTargetDate] = useState("");

  const latest = data.assessments[data.assessments.length - 1];

  const enrichedGoals = useMemo(() => {
    return data.goals.map((g) => {
      let current = g.current_value;
      if (latest && g.unit) {
        const nm = g.name.toLowerCase();
        if (g.unit === "kg" || g.unit === "lb") {
          if (nm.includes("weight") && latest.weight != null) current = latest.weight;
          else if (nm.includes("bench") && latest.bench_1rm != null) current = latest.bench_1rm;
          else if (nm.includes("squat") && latest.squat_1rm != null) current = latest.squat_1rm;
          else if (nm.includes("deadlift") && latest.deadlift_1rm != null) current = latest.deadlift_1rm;
        } else if (g.unit === "%" && nm.includes("fat") && latest.body_fat_pct != null) {
          current = latest.body_fat_pct;
        }
      }
      return { ...g, current_value: current };
    });
  }, [data.goals, latest]);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name,
          target_value: target ? Number(target) : null,
          unit: unit || null,
          target_date: targetDate || null,
        },
      }),
    onSuccess: () => {
      toast.success("Goal added");
      setOpen(false);
      setName(""); setTarget(""); setUnit("kg"); setTargetDate("");
      qc.invalidateQueries({ queryKey: ["progress-data"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress-data"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Your goals</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-lg"><Plus className="mr-1 h-4 w-4" />Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New goal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bench press 100kg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target</Label>
                  <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg / lb / %" />
                </div>
              </div>
              <div>
                <Label>Target date</Label>
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
                {create.isPending ? "Saving…" : "Add goal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {enrichedGoals.length === 0 && (
        <EmptyCard icon={Target} title="No goals yet" subtitle="Set a target to track your progress." />
      )}

      {enrichedGoals.map((g) => {
        const pct = g.target_value && g.current_value
          ? Math.min(100, Math.max(0, (Number(g.current_value) / Number(g.target_value)) * 100))
          : 0;
        return (
          <div key={g.id} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.current_value ?? "—"} / {g.target_value ?? "—"} {g.unit ?? ""}
                  {g.target_date && ` · by ${format(parseISO(g.target_date), "PP")}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(g.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={pct} className="mt-3 h-2" />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{Math.round(pct)}%</p>
          </div>
        );
      })}
    </div>
  );
}
