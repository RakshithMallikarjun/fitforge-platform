import { useState, Suspense } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, Grid2X2, List, Copy, Plus, Pencil, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassHeader } from "@/components/glass-header";
import { ExerciseFormDialog } from "@/components/exercises/exercise-form-dialog";
import {
  listExercises,
  deleteExercise,
  getYoutubeEmbedUrl,
  normaliseExerciseName,
  type ExerciseRow,
} from "@/lib/exercises.functions";
import {
  getLibraryPlans,
  duplicateLibraryExercise,
  addLibraryExerciseToPlan,
} from "@/lib/exercise-library.functions";
import { duplicatePlanAsTemplate } from "@/lib/plans.functions";
import {
  librarySearch,
  filterLibrary,
  canEditLibraryExercise,
  type LibrarySearch,
} from "@/lib/exercise-library";
import { useCurrentUser } from "@/hooks/use-current-user";
import { plural, sentenceCase } from "@/lib/copy";
import { formatServerError } from "@/lib/format-error";

export const exercisesQuery = queryOptions({
  queryKey: ["exercises"],
  queryFn: () => listExercises({ data: {} }),
});
export const libraryPlansQuery = queryOptions({
  queryKey: ["exercise-library-plans"],
  queryFn: () => getLibraryPlans(),
});
export function LibrarySkeleton() {
  return (
    <main className="p-6">
      <Skeleton className="h-12" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Skeleton key={n} className="h-52" />
        ))}
      </div>
    </main>
  );
}
export function LibraryError({ error }: { error: unknown }) {
  return (
    <div role="alert" className="p-6">
      Unable to load the exercise library. {formatServerError(error)}
      <Button variant="outline" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );
}
function Thumb({ exercise }: { exercise: ExerciseRow }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="aspect-video w-full bg-muted">
      {exercise.thumbnail_url && !failed ? (
        <img
          src={exercise.thumbnail_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="grid h-full place-items-center text-muted-foreground">
          <Dumbbell className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}
function Filter({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={name} className="w-full sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {v === "all" ? name : sentenceCase(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function ExerciseLibrary({ search }: { search: LibrarySearch }) {
  const { data: exercises } = useSuspenseQuery(exercisesQuery);
  const { data: plans } = useSuspenseQuery(libraryPlansQuery);
  const { data: me } = useCurrentUser();
  const navigate = useNavigate({ from: "/admin/exercises" });
  const [formOpen, setFormOpen] = useState(false);
  const change = (patch: Partial<LibrarySearch>) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, ...patch }) });
  const filtered = filterLibrary(exercises, search);
  const templates = plans.filter(
    (p) => p.is_template && p.name.toLowerCase().includes(search.q.toLowerCase()),
  );
  return (
    <>
      <GlassHeader title="Exercise library" />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Exercise library</h1>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add exercise
          </Button>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Library">
          <Button
            role="tab"
            aria-selected={search.tab !== "workouts"}
            variant={search.tab !== "workouts" ? "default" : "outline"}
            onClick={() => change({ tab: "exercises", template: "" })}
          >
            Exercises
          </Button>
          <Button
            role="tab"
            aria-selected={search.tab === "workouts"}
            variant={search.tab === "workouts" ? "default" : "outline"}
            onClick={() => change({ tab: "workouts" })}
          >
            Workouts
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Search library"
            placeholder="Search by name"
            className="w-full sm:w-64"
            value={search.q}
            onChange={(e) => change({ q: e.target.value })}
          />
          {search.tab !== "workouts" && (
            <>
              <Filter
                name="All muscles"
                value={search.muscle}
                options={["all", ...new Set(exercises.flatMap((e) => e.muscle_groups))].sort()}
                onChange={(muscle) => change({ muscle })}
              />
              <Filter
                name="All equipment"
                value={search.equipment}
                options={["all", ...new Set(exercises.flatMap((e) => e.equipment))].sort()}
                onChange={(equipment) => change({ equipment })}
              />
              <Filter
                name="Global and Gym"
                value={search.scope}
                options={["all", "global", "gym"]}
                onChange={(scope) => change({ scope })}
              />
              <Filter
                name="All levels"
                value={search.level}
                options={["all", "beginner", "intermediate", "advanced"]}
                onChange={(level) => change({ level })}
              />
              <Select value={search.sort} onValueChange={(sort) => change({ sort })}>
                <SelectTrigger aria-label="Sort by name" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Name A–Z</SelectItem>
                  <SelectItem value="desc">Name Z–A</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                aria-label="Grid view"
                aria-pressed={search.view !== "list"}
                onClick={() => change({ view: "grid" })}
              >
                <Grid2X2 />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="List view"
                aria-pressed={search.view === "list"}
                onClick={() => change({ view: "list" })}
              >
                <List />
              </Button>
            </>
          )}
        </div>
        {search.tab === "workouts" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((p) => (
              <article key={p.id} className="rounded-lg border border-border bg-card p-4">
                <Button
                  variant="link"
                  className="h-auto whitespace-normal p-0 text-left"
                  onClick={() => change({ template: p.id })}
                >
                  {p.name}
                </Button>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plural(p.workout_days.length, "day")} ·{" "}
                  {plural(
                    p.workout_days.reduce((n, d) => n + d.workout_exercises.length, 0),
                    "exercise",
                  )}
                </p>
                {p.notes && <p className="mt-2 text-sm whitespace-pre-line">{p.notes}</p>}
                <Badge className="mt-2" variant="secondary">
                  {sentenceCase(p.status)}
                </Badge>
              </article>
            ))}
            {templates.length === 0 && <Empty onClear={() => change({ q: "" })} />}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{plural(filtered.length, "exercise")}</p>
            <div
              className={
                search.view === "list"
                  ? "divide-y divide-border"
                  : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {filtered.map((e) => {
                const count = plans.filter((p) =>
                  p.workout_days.some((d) =>
                    d.workout_exercises.some((w) => w.exercise_id === e.id),
                  ),
                ).length;
                return (
                  <Link
                    key={e.id}
                    to="/admin/exercises/$exerciseId"
                    params={{ exerciseId: e.id }}
                    search={search}
                    aria-label={`View exercise ${e.name}`}
                    className={
                      search.view === "list"
                        ? "flex flex-wrap items-center gap-3 py-4 focus-visible:outline focus-visible:outline-ring"
                        : "overflow-hidden rounded-lg border border-border bg-card focus-visible:outline focus-visible:outline-ring hover:border-primary"
                    }
                  >
                    {search.view !== "list" && <Thumb exercise={e} />}
                    <div className="min-w-0 flex-1 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-semibold">{e.name}</h2>
                        <Badge variant="secondary">{e.gym_id ? "Gym" : "Global"}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {e.muscle_groups.join(" · ") || "Muscles not specified"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {e.equipment.join(" · ") || "Equipment not specified"}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Used in {plural(count, "workout")}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {filtered.length === 0 && <Empty onClear={() => change(librarySearch({}))} />}
            </div>
          </>
        )}
      </main>
      {formOpen && (
        <ExerciseFormDialog
          open
          onOpenChange={setFormOpen}
          globalNames={
            new Set(exercises.filter((e) => !e.gym_id).map((e) => normaliseExerciseName(e.name)))
          }
        />
      )}
      {search.template && (
        <TemplatePreview
          id={search.template}
          search={search}
          onClose={() => change({ template: "" })}
        />
      )}
      <Suspense fallback={<LibrarySkeleton />}>
        <Outlet />
      </Suspense>
    </>
  );
}
function Empty({ onClear }: { onClear: () => void }) {
  return (
    <div className="col-span-full py-12 text-center">
      <Dumbbell className="mx-auto mb-3 text-muted-foreground" />
      <p>No matches found.</p>
      <Button variant="outline" className="mt-3" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
function TemplatePreview({
  id,
  search,
  onClose,
}: {
  id: string;
  search: LibrarySearch;
  onClose: () => void;
}) {
  const { data: plans } = useSuspenseQuery(libraryPlansQuery);
  const p = plans.find((p) => p.id === id && p.is_template);
  const duplicate = useServerFn(duplicatePlanAsTemplate);
  const qc = useQueryClient();
  const copy = useMutation({
    mutationFn: () => duplicate({ data: { planId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise-library-plans"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Template duplicated");
    },
    onError: (e) => toast.error(formatServerError(e)),
  });
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{p?.name ?? "Template unavailable"}</SheetTitle>
          <SheetDescription>Workout template preview</SheetDescription>
        </SheetHeader>
        {p && (
          <>
            <div className="my-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/admin/plans/new" search={{ templateId: id }}>
                  Use template
                </Link>
              </Button>
              <Button variant="outline" disabled={copy.isPending} onClick={() => copy.mutate()}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
            </div>
            {p.notes && <p className="whitespace-pre-line text-sm">{p.notes}</p>}
            {p.workout_days.map((d) => (
              <section key={d.id} className="mt-6">
                <h3 className="font-semibold">{d.day_label}</h3>
                {d.workout_exercises.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 border-b border-border py-3"
                  >
                    <Link
                      to="/admin/exercises/$exerciseId"
                      params={{ exerciseId: e.exercise_id }}
                      search={{ ...search, template: "" }}
                      className="font-medium underline underline-offset-4"
                    >
                      {e.exercises?.name ?? "Exercise"}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {e.sets ?? "—"} × {e.reps ?? "—"} · {e.rest_seconds ?? 0}s rest
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
export function ExerciseDetail({ id, search }: { id: string; search: LibrarySearch }) {
  const { data: exercises } = useSuspenseQuery(exercisesQuery);
  const { data: plans } = useSuspenseQuery(libraryPlansQuery);
  const { data: me } = useCurrentUser();
  const exercise = exercises.find((e) => e.id === id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const duplicate = useServerFn(duplicateLibraryExercise);
  const deleteFn = useServerFn(deleteExercise);
  const close = () => navigate({ to: "/admin/exercises", search });
  const copy = useMutation({
    mutationFn: () => duplicate({ data: { exerciseId: id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      toast.success("Exercise duplicated to your gym");
      navigate({ to: "/admin/exercises/$exerciseId", params: { exerciseId: r.id }, search });
    },
    onError: (e) => toast.error(formatServerError(e)),
  });
  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      toast.success("Exercise deleted");
      close();
    },
    onError: (e) => toast.error("Delete failed", { description: formatServerError(e) }),
  });
  const filtered = filterLibrary(exercises, search);
  const index = filtered.findIndex((e) => e.id === id);
  const used = plans.flatMap((p) =>
    p.workout_days.flatMap((d) =>
      d.workout_exercises.filter((w) => w.exercise_id === id).map((w) => ({ p, d, w })),
    ),
  );
  const embed = exercise?.video_url ? getYoutubeEmbedUrl(exercise.video_url) : null;
  const admin = !!me?.roles.includes("admin");
  const editable = exercise && canEditLibraryExercise(admin, me?.gymId ?? null, exercise);
  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-2xl"
        aria-describedby="exercise-detail-description"
      >
        <SheetHeader>
          <SheetTitle>{exercise?.name ?? "Exercise not found"}</SheetTitle>
          <SheetDescription id="exercise-detail-description">
            {exercise?.gym_id ? "Gym" : "Global"} exercise
          </SheetDescription>
        </SheetHeader>
        {exercise ? (
          <div className="mt-5 space-y-6">
            <div className="aspect-video overflow-hidden rounded-lg bg-muted">
              {embed ? (
                playing ? (
                  <iframe
                    key={id}
                    src={`${embed}?autoplay=1&playsinline=1`}
                    title={`${exercise.name} demonstration`}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                ) : (
                  <Button
                    variant="ghost"
                    aria-label={`Play ${exercise.name} video`}
                    className="relative h-full w-full p-0"
                    onClick={() => setPlaying(true)}
                  >
                    <Thumb exercise={exercise} />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="rounded-full bg-background p-4 text-foreground">
                        <Play />
                      </span>
                    </span>
                  </Button>
                )
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No video available
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{exercise.gym_id ? "Gym" : "Global"}</Badge>
              {exercise.difficulty && (
                <Badge variant="outline">{sentenceCase(exercise.difficulty)}</Badge>
              )}
              <Badge variant="outline">
                {exercise.tracking === "time" ? "Timed" : "Repetitions"}
              </Badge>
            </div>
            <section>
              <h3 className="mb-2 font-semibold">Muscles</h3>
              <div className="flex flex-wrap gap-2">
                {exercise.muscle_groups.map((m) => (
                  <Badge key={m} variant="outline">
                    {sentenceCase(m)}
                  </Badge>
                ))}
                {!exercise.muscle_groups.length && (
                  <p className="text-sm text-muted-foreground">Not specified</p>
                )}
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Equipment</h3>
              <div className="flex flex-wrap gap-2">
                {exercise.equipment.map((m) => (
                  <Badge key={m} variant="outline">
                    {sentenceCase(m)}
                  </Badge>
                ))}
                {!exercise.equipment.length && (
                  <p className="text-sm text-muted-foreground">Not specified</p>
                )}
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Instructions</h3>
              {exercise.description ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {exercise.description
                    .split(/\n+/)
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No instructions recorded.</p>
              )}
            </section>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setAdding(true)}>
                Add to plan
              </Button>
              {editable && (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => setConfirm(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
              {admin && !exercise.gym_id && (
                <Button variant="outline" disabled={copy.isPending} onClick={() => copy.mutate()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate to my gym
                </Button>
              )}
            </div>
            <section>
              <h3 className="mb-3 font-semibold">Used in</h3>
              {used.length ? (
                used.map(({ p, d, w }) => (
                  <div key={w.id} className="space-y-1 border-b border-border py-3">
                    <Link
                      to="/admin/plans/$planId"
                      params={{ planId: p.id }}
                      className="font-medium underline underline-offset-4"
                    >
                      {p.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {p.is_template ? "Template" : (p.users?.display_name ?? "Assigned member")} ·{" "}
                      {d.day_label} · {w.sets ?? "—"} × {w.reps ?? "—"} · {w.rest_seconds ?? 0}s
                      rest · {sentenceCase(p.status)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Not used in any workout yet.</p>
              )}
            </section>
            <div className="flex justify-between">
              <Button
                variant="outline"
                disabled={index <= 0}
                onClick={() => {
                  const previous = filtered[index - 1];
                  if (previous) {
                    setPlaying(false);
                    navigate({
                      to: "/admin/exercises/$exerciseId",
                      params: { exerciseId: previous.id },
                      search,
                    });
                  }
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={index < 0 || index >= filtered.length - 1}
                onClick={() => {
                  const next = filtered[index + 1];
                  if (next) {
                    setPlaying(false);
                    navigate({
                      to: "/admin/exercises/$exerciseId",
                      params: { exerciseId: next.id },
                      search,
                    });
                  }
                }}
              >
                Next
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-4">This exercise is unavailable.</p>
        )}
        {editing && exercise && (
          <ExerciseFormDialog key={id} open onOpenChange={setEditing} initial={exercise} />
        )}
        {adding && <AddToPlan id={id} onClose={() => setAdding(false)} />}
        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {exercise?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the exercise from your gym library. Exercises used in workouts may need
                to be removed from those workouts first.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={del.isPending} onClick={() => del.mutate()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
function AddToPlan({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: plans } = useSuspenseQuery(libraryPlansQuery);
  const available = plans.filter((p) => p.is_template || p.status === "active");
  const [planId, setPlanId] = useState("");
  const [dayId, setDayId] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("");
  const fn = useServerFn(addLibraryExerciseToPlan);
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: () => fn({ data: { exerciseId: id, planId, dayId, sets: Number(sets), reps } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise-library-plans"] });
      qc.invalidateQueries({ queryKey: ["plan", planId] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Exercise added to plan");
      onClose();
    },
    onError: (e) => toast.error(formatServerError(e)),
  });
  const plan = available.find((p) => p.id === planId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to plan</DialogTitle>
        </DialogHeader>
        {!available.length ? (
          <p>No active plans or templates available.</p>
        ) : (
          <div className="space-y-4">
            <Label htmlFor="library-plan">Plan or template</Label>
            <Select
              value={planId}
              onValueChange={(v) => {
                setPlanId(v);
                setDayId("");
              }}
            >
              <SelectTrigger id="library-plan">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.is_template ? "Template" : (p.users?.display_name ?? "Member")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label htmlFor="library-day">Day</Label>
            <Select value={dayId} onValueChange={setDayId}>
              <SelectTrigger id="library-day">
                <SelectValue placeholder="Choose a day" />
              </SelectTrigger>
              <SelectContent>
                {plan?.workout_days.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.day_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="library-sets">Sets</Label>
                <Input
                  id="library-sets"
                  type="number"
                  min={1}
                  max={10}
                  value={sets}
                  onChange={(e) => setSets(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="library-reps">Reps / seconds</Label>
                <Input id="library-reps" value={reps} onChange={(e) => setReps(e.target.value)} />
              </div>
            </div>
            <Button
              disabled={
                !planId ||
                !dayId ||
                !reps.trim() ||
                !Number.isInteger(Number(sets)) ||
                Number(sets) < 1 ||
                Number(sets) > 10 ||
                add.isPending
              }
              onClick={() => add.mutate()}
            >
              Add exercise
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
