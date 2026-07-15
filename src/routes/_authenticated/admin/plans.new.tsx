import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Activity, X, Sparkles, Check } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { listMembers } from "@/lib/members.functions";
import { createPlan, getMemberSnapshot } from "@/lib/plans.functions";
import { suggestOverload, type ExerciseSuggestion } from "@/lib/overload.functions";
import { ExercisePickerDialog } from "@/components/exercises/exercise-picker-dialog";
import type { ExerciseRow } from "@/lib/exercises.functions";

export const Route = createFileRoute("/_authenticated/admin/plans/new")({
  validateSearch: z.object({
    memberId: z.string().uuid().optional(),
    isTemplate: z.boolean().optional(),
  }),
  component: PlanBuilder,
});

type ExerciseInput = {
  uid: string;
  exercise: ExerciseRow;
  sets: number;
  reps: string;
  rest_seconds: number;
  tempo: string;
  notes: string;
};

type BlockType = "warmup" | "main" | "cooldown";

type DayInput = {
  uid: string;
  label: string;
  block_type: BlockType;
  exercises: ExerciseInput[];
};

const BLOCK_META: Record<BlockType, { label: string; badgeClass: string; emoji: string }> = {
  warmup: { label: "Warm-Up", badgeClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900", emoji: "🔥" },
  main: { label: "Main Workout", badgeClass: "bg-primary/15 text-primary border-primary/30", emoji: "💪" },
  cooldown: { label: "Cooldown", badgeClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900", emoji: "🧘" },
};

let uidCounter = 0;
const uid = () => `id-${++uidCounter}-${Date.now()}`;

function PlanBuilder() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/admin/plans/new" });

  const forceTemplate = search.isTemplate === true;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState<string>(search.memberId ?? "");
  const [startDate, setStartDate] = useState("");
  const [durationWeeks, setDurationWeeks] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isTemplate, setIsTemplate] = useState(forceTemplate);
  const [days, setDays] = useState<DayInput[]>([{ uid: uid(), label: "Day 1", block_type: "main", exercises: [] }]);
  const [pickerForDay, setPickerForDay] = useState<string | null>(null);

  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => listMembers() });
  const { data: snapshot } = useQuery({
    enabled: !!memberId,
    queryKey: ["snapshot", memberId],
    queryFn: () => getMemberSnapshot({ data: { memberId } }),
  });

  const create = useMutation({
    mutationFn: () =>
      createPlan({
        data: {
          name,
          member_id: isTemplate ? null : memberId || null,
          start_date: startDate || null,
          duration_weeks: durationWeeks ? Number(durationWeeks) : null,
          notes: notes || null,
          is_template: isTemplate,
          days: days.map((d) => ({
            day_label: d.label,
            block_type: d.block_type,
            exercises: d.exercises.map((e) => ({
              exercise_id: e.exercise.id,
              sets: e.sets || null,
              reps: e.reps || null,
              rest_seconds: e.rest_seconds || null,
              tempo: e.tempo || null,
              notes: e.notes || null,
            })),
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(isTemplate ? "Template saved" : "Plan assigned");
      if (isTemplate) navigate({ to: "/admin/templates" });
      else navigate({ to: "/admin/plans/$planId", params: { planId: r.id } });
    },
    onError: (e: any) => toast.error("Save failed", { description: e?.message }),
  });

  const canStep2 = name && (isTemplate || memberId);
  const canFinish = canStep2 && days.length > 0;

  return (
    <>
      <GlassHeader title="New plan" subtitle={`Step ${step} of 3`} />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <div className="flex items-center gap-2 text-sm">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setStep(n as 1 | 2 | 3)}
              className={`rounded-full px-3 py-1.5 ${step === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {n === 1 ? "Details" : n === 2 ? "Days" : "Review"}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {step === 1 && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div>
                  <Label>Plan name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hypertrophy block 1" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="tpl" checked={isTemplate} onCheckedChange={(v) => setIsTemplate(!!v)} />
                  <Label htmlFor="tpl" className="cursor-pointer">Save as template (not assigned to a member)</Label>
                </div>
                {!isTemplate && (
                  <div>
                    <Label>Assign to member</Label>
                    <Select value={memberId} onValueChange={setMemberId}>
                      <SelectTrigger><SelectValue placeholder="Select a member…" /></SelectTrigger>
                      <SelectContent>
                        {members.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.display_name ?? m.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Duration (weeks)</Label>
                    <Input type="number" min={1} value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button disabled={!canStep2} onClick={() => setStep(2)}>Next: Days</Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <DayBuilder days={days} setDays={setDays} onPick={(uid) => setPickerForDay(uid)} onNext={() => setStep(3)} />
            )}

            {step === 3 && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h3 className="text-lg font-semibold">Review</h3>
                <div className="text-sm">
                  <p><span className="text-muted-foreground">Name:</span> {name}</p>
                  <p><span className="text-muted-foreground">Member:</span> {isTemplate ? "— (template)" : members.find((m: any) => m.id === memberId)?.display_name ?? "—"}</p>
                  <p><span className="text-muted-foreground">Days:</span> {days.length} · <span className="text-muted-foreground">Exercises:</span> {days.reduce((a, d) => a + d.exercises.length, 0)}</p>
                </div>
                <ul className="space-y-2">
                  {days.map((d) => (
                    <li key={d.uid} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-semibold">{d.label}</p>
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {d.exercises.map((e) => (
                          <li key={e.uid}>• {e.exercise.name} — {e.sets || "?"}×{e.reps || "?"}</li>
                        ))}
                        {d.exercises.length === 0 && <li className="italic">No exercises</li>}
                      </ul>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button disabled={!canFinish || create.isPending} onClick={() => create.mutate()}>
                    {create.isPending ? "Saving…" : isTemplate ? "Save template" : "Assign plan"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Side snapshot panel */}
          <aside className="space-y-4">
            {!isTemplate && memberId && snapshot && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <Activity className="h-4 w-4 text-primary" /> Latest assessment
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Weight" value={snapshot.weight ? `${snapshot.weight} kg` : "—"} />
                  <Stat label="Body fat" value={snapshot.body_fat_pct ? `${snapshot.body_fat_pct}%` : "—"} />
                  <Stat label="Bench 1RM" value={snapshot.bench_1rm ? `${snapshot.bench_1rm} kg` : "—"} />
                  <Stat label="Squat 1RM" value={snapshot.squat_1rm ? `${snapshot.squat_1rm} kg` : "—"} />
                  <Stat label="Deadlift 1RM" value={snapshot.deadlift_1rm ? `${snapshot.deadlift_1rm} kg` : "—"} />
                </dl>
              </div>
            )}
            {!isTemplate && memberId && !snapshot && (
              <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                No assessment on file yet.
              </div>
            )}
            {!isTemplate && memberId && (
              <AiSuggestionsPanel
                memberId={memberId}
                days={days}
                onApply={(exId, w, r) => {
                  setDays((prev) =>
                    prev.map((d) => ({
                      ...d,
                      exercises: d.exercises.map((e) =>
                        e.exercise.id === exId
                          ? {
                              ...e,
                              reps: r != null ? String(r) : e.reps,
                              notes: e.notes
                                ? `${e.notes} · target ${w ?? "—"}kg`
                                : `Target ${w ?? "—"}kg`,
                            }
                          : e,
                      ),
                    })),
                  );
                  toast.success("Suggestion applied");
                }}
              />
            )}
          </aside>
        </div>
      </main>

      <ExercisePickerDialog
        open={!!pickerForDay}
        onOpenChange={(v) => !v && setPickerForDay(null)}
        onPick={(ex) => {
          setDays((prev) =>
            prev.map((d) =>
              d.uid === pickerForDay
                ? { ...d, exercises: [...d.exercises, { uid: uid(), exercise: ex, sets: 3, reps: "8-12", rest_seconds: 90, tempo: "", notes: "" }] }
                : d,
            ),
          );
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

function DayBuilder({
  days, setDays, onPick, onNext,
}: {
  days: DayInput[];
  setDays: React.Dispatch<React.SetStateAction<DayInput[]>>;
  onPick: (uid: string) => void;
  onNext: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDayDragEnd = (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    setDays((prev) => {
      const oldI = prev.findIndex((d) => d.uid === active.id);
      const newI = prev.findIndex((d) => d.uid === over.id);
      return arrayMove(prev, oldI, newI);
    });
  };
  const addDay = () => setDays((p) => [...p, { uid: uid(), label: `Day ${p.length + 1}`, block_type: "main", exercises: [] }]);

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDayDragEnd}>
        <SortableContext items={days.map((d) => d.uid)} strategy={verticalListSortingStrategy}>
          {days.map((d) => (
            <SortableDay key={d.uid} day={d} setDays={setDays} onPick={() => onPick(d.uid)} />
          ))}
        </SortableContext>
      </DndContext>
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={addDay}><Plus className="mr-1.5 h-4 w-4" /> Add day</Button>
        <Button onClick={onNext} disabled={days.length === 0}>Next: Review</Button>
      </div>
    </div>
  );
}

function SortableDay({
  day, setDays, onPick,
}: {
  day: DayInput;
  setDays: React.Dispatch<React.SetStateAction<DayInput[]>>;
  onPick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.uid });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const sensors = useSensors(useSensor(PointerSensor));

  const updateLabel = (v: string) => setDays((p) => p.map((x) => (x.uid === day.uid ? { ...x, label: v } : x)));
  const updateBlockType = (v: BlockType) =>
    setDays((p) => p.map((x) => (x.uid === day.uid ? { ...x, block_type: v } : x)));
  const remove = () => setDays((p) => p.filter((x) => x.uid !== day.uid));
  const updateEx = (uid: string, patch: Partial<ExerciseInput>) =>
    setDays((p) => p.map((x) => x.uid === day.uid ? { ...x, exercises: x.exercises.map((e) => e.uid === uid ? { ...e, ...patch } : e) } : x));
  const removeEx = (uid: string) =>
    setDays((p) => p.map((x) => x.uid === day.uid ? { ...x, exercises: x.exercises.filter((e) => e.uid !== uid) } : x));

  const onExDragEnd = (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    setDays((p) => p.map((x) => {
      if (x.uid !== day.uid) return x;
      const oldI = x.exercises.findIndex((e) => e.uid === active.id);
      const newI = x.exercises.findIndex((e) => e.uid === over.id);
      return { ...x, exercises: arrayMove(x.exercises, oldI, newI) };
    }));
  };

  const meta = BLOCK_META[day.block_type];

  return (
    <div ref={setNodeRef} style={style} className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></button>
        <Input value={day.label} onChange={(e) => updateLabel(e.target.value)} className="max-w-[200px] font-semibold" />
        <Select value={day.block_type} onValueChange={(v) => updateBlockType(v as BlockType)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="warmup">Warm-Up</SelectItem>
            <SelectItem value="main">Main Workout</SelectItem>
            <SelectItem value="cooldown">Cooldown</SelectItem>
          </SelectContent>
        </Select>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}>
          <span>{meta.emoji}</span> {meta.label}
        </span>
        <Badge variant="secondary" className="ml-auto">{day.exercises.length} exercises</Badge>
        <Button variant="ghost" size="icon" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      <div className="space-y-2 p-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onExDragEnd}>
          <SortableContext items={day.exercises.map((e) => e.uid)} strategy={verticalListSortingStrategy}>
            {day.exercises.map((e) => (
              <SortableExercise key={e.uid} ex={e} onChange={(p) => updateEx(e.uid, p)} onRemove={() => removeEx(e.uid)} />
            ))}
          </SortableContext>
        </DndContext>
        <Button variant="outline" size="sm" className="w-full" onClick={onPick}>
          <Plus className="mr-1.5 h-4 w-4" /> Add exercise
        </Button>
      </div>
    </div>
  );
}

function SortableExercise({ ex, onChange, onRemove }: { ex: ExerciseInput; onChange: (p: Partial<ExerciseInput>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.uid });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></button>
        <p className="flex-1 truncate text-sm font-semibold">{ex.exercise.name}</p>
        <Button variant="ghost" size="icon" onClick={onRemove}><X className="h-4 w-4" /></Button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Field label="Sets"><Input type="number" min={1} value={ex.sets} onChange={(e) => onChange({ sets: Number(e.target.value) })} /></Field>
        <Field label="Reps"><Input value={ex.reps} onChange={(e) => onChange({ reps: e.target.value })} placeholder="8-12" /></Field>
        <Field label="Rest (s)"><Input type="number" min={0} value={ex.rest_seconds} onChange={(e) => onChange({ rest_seconds: Number(e.target.value) })} /></Field>
        <Field label="Tempo"><Input value={ex.tempo} onChange={(e) => onChange({ tempo: e.target.value })} placeholder="3-1-1" /></Field>
      </div>
      <div className="mt-2">
        <Field label="Notes"><Input value={ex.notes} onChange={(e) => onChange({ notes: e.target.value })} /></Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AiSuggestionsPanel({
  memberId,
  days,
  onApply,
}: {
  memberId: string;
  days: DayInput[];
  onApply: (exerciseId: string, weight: number | null, reps: number | null) => void;
}) {
  const exerciseIds = useMemo(() => {
    const s = new Set<string>();
    for (const d of days) for (const e of d.exercises) s.add(e.exercise.id);
    return Array.from(s);
  }, [days]);

  const suggestFn = useServerFn(suggestOverload);
  const mutation = useMutation({
    mutationFn: () => suggestFn({ data: { memberId, exerciseIds } }),
    onError: (e: any) => toast.error("Suggestions failed", { description: e?.message }),
  });

  const suggestions: ExerciseSuggestion[] = mutation.data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Sparkles className="h-4 w-4 text-primary" /> AI suggestions
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Next-week targets based on the member's last 4 weeks of logs.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        disabled={exerciseIds.length === 0 || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending
          ? "Analyzing…"
          : suggestions.length
            ? "Refresh"
            : "Generate suggestions"}
      </Button>
      {suggestions.length > 0 && (
        <ul className="mt-4 space-y-2">
          {suggestions.map((s) => (
            <li key={s.exerciseId} className="rounded-xl border border-border bg-background p-3 text-xs">
              <p className="font-semibold text-foreground">{s.exerciseName}</p>
              <p className="mt-0.5 text-muted-foreground">
                Now: {s.currentAvg.weight ?? "—"}kg × {s.currentAvg.reps ?? "—"}
              </p>
              <p className="mt-0.5 text-primary">
                Target: {s.suggestedWeight ?? "—"}kg × {s.suggestedReps ?? "—"}
              </p>
              <p className="mt-1 italic text-muted-foreground">{s.reasoning}</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 h-7 gap-1 px-2 text-xs"
                onClick={() => onApply(s.exerciseId, s.suggestedWeight, s.suggestedReps)}
              >
                <Check className="h-3 w-3" /> Apply
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
