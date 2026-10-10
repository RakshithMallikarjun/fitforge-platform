import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createGoalV2,
  deleteGoalV2,
  listGoalExercises,
  listGoals,
  updateGoalV2,
  type GoalView,
} from "@/lib/goals.functions";
import { BODY_METRICS, type BodyMetric, type GoalType } from "@/lib/goal-progress";
import { formatServerError } from "@/lib/format-error";
import { formatShortDate } from "@/lib/format-date";

const TYPE_LABEL: Record<GoalType, string> = {
  strength: "Strength",
  body: "Body",
  attendance: "Attendance",
  custom: "Custom",
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function GoalsPanel({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const fetchGoals = useServerFn(listGoals);
  const delFn = useServerFn(deleteGoalV2);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["goals"],
    queryFn: () => fetchGoals(),
  });
  const [editing, setEditing] = useState<GoalView | "new" | null>(null);
  const [confirm, setConfirm] = useState<GoalView | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const timers = useRef(new Map<string, number>());

  function scheduleDelete(g: GoalView) {
    setHidden((h) => [...h, g.id]);
    const t = window.setTimeout(async () => {
      timers.current.delete(g.id);
      try {
        await delFn({ data: { id: g.id } });
        qc.invalidateQueries({ queryKey: ["goals"] });
      } catch (e) {
        setHidden((h) => h.filter((x) => x !== g.id));
        toast.error("Couldn't delete goal", { description: formatServerError(e) });
      }
    }, 5000);
    timers.current.set(g.id, t);
    toast(`Deleted "${g.name}"`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const id = timers.current.get(g.id);
          if (id) window.clearTimeout(id);
          timers.current.delete(g.id);
          setHidden((h) => h.filter((x) => x !== g.id));
        },
      },
    });
  }

  const goals = (data ?? []).filter((g) => !hidden.includes(g.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{compact ? "My goals" : "Your goals"}</h3>
        <Button size="sm" className="rounded-lg" onClick={() => setEditing("new")}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-destructive/30 p-4 text-sm">
          <span className="text-destructive">Couldn't load goals. {formatServerError(error)}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <Target className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">No goals yet</p>
          <p className="text-xs text-muted-foreground">Set a target to track your progress.</p>
        </div>
      ) : (
        goals.map((g) => <GoalCard key={g.id} g={g} onEdit={() => setEditing(g)} onDelete={() => setConfirm(g)} />)
      )}

      {editing && (
        <GoalDialog goal={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{confirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>You can undo this for 5 seconds.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) scheduleDelete(confirm);
                setConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GoalCard({ g, onEdit, onDelete }: { g: GoalView; onEdit: () => void; onDelete: () => void }) {
  const unit = g.unit ? ` ${g.unit}` : "";
  const values =
    g.goal_type === "body"
      ? `${fmt(g.current_value)} → ${fmt(g.target_value)}${unit}`
      : `${fmt(g.current_value)} / ${fmt(g.target_value)}${unit}`;
  const sub =
    g.goal_type === "strength"
      ? `Best logged ${g.exercise_name ?? "set"}`
      : g.goal_type === "body"
        ? `Latest assessment · ${BODY_METRICS[g.metric as BodyMetric]?.label ?? ""}`
        : g.goal_type === "attendance"
          ? "Check-ins this month"
          : "Updated by you";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{g.name}</p>
            <Badge variant="secondary">{TYPE_LABEL[g.goal_type]}</Badge>
            {g.status === "achieved" && (
              <Badge>Achieved{g.achieved_at ? ` ${formatShortDate(g.achieved_at.slice(0, 10))}` : ""}</Badge>
            )}
            {g.status === "overdue" && <Badge variant="destructive">Overdue</Badge>}
          </div>
          <p className="mt-1 text-sm font-medium tabular-nums">
            {values} <span className="text-muted-foreground">({g.percent}%)</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {sub}
            {g.target_date && ` · by ${formatShortDate(g.target_date)}`}
          </p>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" aria-label={`Edit ${g.name}`} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${g.name}`} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Progress value={g.percent} className="mt-3 h-2" />
    </div>
  );
}

function GoalDialog({ goal, onClose }: { goal: GoalView | null; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createGoalV2);
  const updateFn = useServerFn(updateGoalV2);
  const exFn = useServerFn(listGoalExercises);
  const [type, setType] = useState<GoalType>(goal?.goal_type ?? "strength");
  const [name, setName] = useState(goal?.name ?? "");
  const [exerciseId, setExerciseId] = useState(goal?.exercise_id ?? "");
  const [metric, setMetric] = useState<BodyMetric>((goal?.metric as BodyMetric) ?? "weight");
  const [target, setTarget] = useState(goal?.target_value != null ? String(goal.target_value) : "");
  const [current, setCurrent] = useState(goal?.current_value != null ? String(goal.current_value) : "");
  const [unit, setUnit] = useState(goal?.unit ?? "kg");
  const [date, setDate] = useState(goal?.target_date ?? "");
  const today = localToday();

  const { data: exercises = [] } = useQuery({
    queryKey: ["goal-exercises"],
    queryFn: () => exFn(),
    enabled: !goal && type === "strength",
  });

  const save = useMutation({
    mutationFn: async () => {
      const t = Number(target);
      if (!target || !Number.isFinite(t) || t <= 0) throw new Error("Enter a target above 0");
      if (date && date < today && date !== goal?.target_date)
        throw new Error("Target date must be today or later");
      const cur = current === "" ? null : Number(current);
      if (goal) {
        return updateFn({
          data: {
            id: goal.id,
            name,
            target_value: t,
            unit: unit || null,
            target_date: date || null,
            ...(goal.goal_type === "custom" ? { current_value: cur } : {}),
          },
        });
      }
      return createFn({
        data: {
          name,
          goal_type: type,
          exercise_id: type === "strength" ? exerciseId || null : null,
          metric: type === "body" ? metric : null,
          target_value: t,
          current_value: type === "custom" ? cur : null,
          unit: type === "custom" || type === "strength" ? unit || null : null,
          target_date: date || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(goal ? "Goal updated" : "Goal added");
      qc.invalidateQueries({ queryKey: ["goals"] });
      onClose();
    },
    onError: (e) => toast.error("Couldn't save goal", { description: formatServerError(e) }),
  });

  const showUnit = goal ? goal.goal_type === "custom" || goal.goal_type === "strength" : type === "custom" || type === "strength";
  const isCustom = goal ? goal.goal_type === "custom" : type === "custom";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!goal && (
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as GoalType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">Strength — best logged lift</SelectItem>
                  <SelectItem value="body">Body — from your assessments</SelectItem>
                  <SelectItem value="attendance">Attendance — check-ins per month</SelectItem>
                  <SelectItem value="custom">Custom — update it yourself</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="goal-name">Name</Label>
            <Input id="goal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bench press 80 kg" />
          </div>
          {!goal && type === "strength" && (
            <div>
              <Label>Exercise</Label>
              <Select value={exerciseId} onValueChange={setExerciseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an exercise" />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!goal && type === "body" && (
            <div>
              <Label>Measurement</Label>
              <Select value={metric} onValueChange={(v) => setMetric(v as BodyMetric)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BODY_METRICS) as BodyMetric[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {BODY_METRICS[m].label} ({BODY_METRICS[m].unit}, {BODY_METRICS[m].direction === "down" ? "lower is better" : "higher is better"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="goal-target">Target</Label>
              <Input id="goal-target" type="number" inputMode="decimal" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            {showUnit && (
              <div>
                <Label htmlFor="goal-unit">Unit</Label>
                <Input id="goal-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg / reps / km" />
              </div>
            )}
            {isCustom && (
              <div>
                <Label htmlFor="goal-current">Current</Label>
                <Input id="goal-current" type="number" inputMode="decimal" min={0} value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="goal-date">Target date</Label>
            <Input id="goal-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!name.trim() || !target || save.isPending || (!goal && type === "strength" && !exerciseId)}
          >
            {save.isPending ? "Saving…" : goal ? "Save" : "Add goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
