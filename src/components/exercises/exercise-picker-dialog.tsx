import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus } from "lucide-react";
import { listExercises, type ExerciseRow } from "@/lib/exercises.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (e: ExerciseRow) => void;
};

export function ExercisePickerDialog({ open, onOpenChange, onPick }: Props) {
  const [search, setSearch] = useState("");
  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => listExercises({ data: {} }),
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return exercises.filter((e) => !s || e.name.toLowerCase().includes(s));
  }, [exercises, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add exercises</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-[400px] overflow-y-auto rounded-xl border border-border">
          <ul className="divide-y divide-border">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-3">
                {e.thumbnail_url ? (
                  <img src={e.thumbnail_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                    {(e.muscle_groups?.[0] ?? "ex").slice(0, 3)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {(e.muscle_groups ?? []).slice(0, 3).map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onPick(e)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">No exercises found.</li>
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
