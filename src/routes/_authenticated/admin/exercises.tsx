import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Dumbbell, MoreHorizontal, Pencil, Trash2, Lock } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listExercises, deleteExercise, type ExerciseRow } from "@/lib/exercises.functions";
import { ExerciseFormDialog } from "@/components/exercises/exercise-form-dialog";

export const Route = createFileRoute("/_authenticated/admin/exercises")({
  component: ExercisesPage,
});

const DIFF_COLOR: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-rose-100 text-rose-700",
};

function ExercisesPage() {
  const { data: me } = useCurrentUser();
  const canManage = me?.roles.includes("admin") || me?.roles.includes("trainer");
  const isAdmin = me?.roles.includes("admin");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>("all");
  const [equipFilter, setEquipFilter] = useState<string>("all");
  const [diffFilter, setDiffFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseRow | null>(null);

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => listExercises({ data: {} }),
  });

  const muscleOptions = useMemo(
    () => Array.from(new Set(exercises.flatMap((e) => e.muscle_groups ?? []))).sort(),
    [exercises],
  );
  const equipOptions = useMemo(
    () => Array.from(new Set(exercises.flatMap((e) => e.equipment ?? []))).sort(),
    [exercises],
  );

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return exercises.filter((e) => {
      if (s && !e.name.toLowerCase().includes(s)) return false;
      if (muscleFilter !== "all" && !(e.muscle_groups ?? []).includes(muscleFilter)) return false;
      if (equipFilter !== "all" && !(e.equipment ?? []).includes(equipFilter)) return false;
      if (diffFilter !== "all" && e.difficulty !== diffFilter) return false;
      return true;
    });
  }, [exercises, search, muscleFilter, equipFilter, diffFilter]);

  const del = useMutation({
    mutationFn: (id: string) => deleteExercise({ data: { id } }),
    onSuccess: () => {
      toast.success("Exercise deleted");
      qc.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (e: any) => toast.error("Delete failed", { description: e?.message }),
  });

  return (
    <>
      <GlassHeader title="Exercises" subtitle="Library of movements for your plans" />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Exercise library</h2>
            <p className="text-sm text-muted-foreground">
              <Badge variant="secondary" className="rounded-full">{exercises.length} exercises</Badge>
            </p>
          </div>
          {canManage && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" /> Add exercise
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises…" className="pl-9" />
          </div>
          <Select value={muscleFilter} onValueChange={setMuscleFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Muscle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All muscles</SelectItem>
              {muscleOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={equipFilter} onValueChange={setEquipFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Equipment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All equipment</SelectItem>
              {equipOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={diffFilter} onValueChange={setDiffFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => {
              const isGlobal = e.gym_id === null;
              return (
                <div key={e.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-[var(--shadow-card)]">
                  <div className="aspect-video bg-muted">
                    {e.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.thumbnail_url} alt={e.name} className="h-full w-full object-cover" onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground"><Dumbbell className="h-8 w-8" /></div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{e.name}</h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(e.muscle_groups ?? []).slice(0, 3).map((m) => (
                            <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                          ))}
                        </div>
                      </div>
                      {e.difficulty && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${DIFF_COLOR[e.difficulty] ?? "bg-muted"}`}>
                          {e.difficulty}
                        </span>
                      )}
                    </div>
                  </div>
                  {isGlobal ? (
                    <div className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                      <Lock className="h-3 w-3" /> Global
                    </div>
                  ) : (
                    <div className="absolute right-2 top-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(e); setFormOpen(true); }}>
                            <Pencil className="mr-1.5 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem className="text-destructive" onClick={() => del.mutate(e.id)}>
                              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {e.description && (
                    <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-background/95 via-background/40 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="text-xs text-foreground/90">{e.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
                <Dumbbell className="h-6 w-6" /> No exercises match your filters.
              </div>
            )}
          </div>
        )}
      </main>

      <ExerciseFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} />
    </>
  );
}
