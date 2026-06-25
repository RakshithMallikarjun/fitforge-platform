import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignTrainers, listTrainers } from "@/lib/members.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string;
  memberName: string;
  initialTrainerIds: string[];
};

export function AssignTrainersDialog({ open, onOpenChange, memberId, memberName, initialTrainerIds }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialTrainerIds));

  useEffect(() => {
    if (open) setSelected(new Set(initialTrainerIds));
  }, [open, initialTrainerIds]);

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ["trainers"],
    queryFn: () => listTrainers(),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () => assignTrainers({ data: { memberId, trainerIds: Array.from(selected) } }),
    onSuccess: () => {
      toast.success("Trainers updated", { description: memberName });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member", memberId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Could not update trainers", { description: e?.message }),
  });

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign trainers</DialogTitle>
          <DialogDescription>Pick the trainers who will coach {memberName}.</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="grid place-items-center py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : trainers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No trainers in this gym yet.</p>
          ) : (
            trainers.map((t: any) => {
              const on = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    on ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                  ].join(" ")}
                >
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-primary">
                    {t.photo_url ? <img src={t.photo_url} alt="" className="h-full w-full object-cover" /> : (t.display_name ?? t.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.display_name ?? t.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.email}</p>
                  </div>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
