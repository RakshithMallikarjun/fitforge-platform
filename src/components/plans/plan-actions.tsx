import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { deletePlan, duplicatePlanAsTemplate, setPlanArchived } from "@/lib/plans.functions";
import { formatServerError } from "@/lib/format-error";

export function PlanActions({
  plan,
  sessionCount,
  afterDelete,
}: {
  plan: { id: string; name: string; status: string; is_template: boolean };
  /** Known logged-session count (detail page). Unknown in lists; the server decides. */
  sessionCount?: number;
  afterDelete?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["plans"] });
    qc.invalidateQueries({ queryKey: ["plan", plan.id] });
    qc.invalidateQueries({ queryKey: ["member"] });
  };

  const archive = useMutation({
    mutationFn: (archived: boolean) => setPlanArchived({ data: { planId: plan.id, archived } }),
    onSuccess: (_r, archived) => {
      toast.success(archived ? "Plan archived" : "Plan is active again");
      refresh();
    },
    onError: (e: any) => toast.error("Couldn't update the plan", { description: formatServerError(e) }),
  });

  const duplicate = useMutation({
    mutationFn: () => duplicatePlanAsTemplate({ data: { planId: plan.id } }),
    onSuccess: () => {
      toast.success("Saved as a template", {
        action: { label: "Open templates", onClick: () => navigate({ to: "/admin/templates" }) },
      });
      refresh();
    },
    onError: (e: any) => toast.error("Couldn't duplicate the plan", { description: formatServerError(e) }),
  });

  const del = useMutation({
    mutationFn: () => deletePlan({ data: { planId: plan.id } }),
    onSuccess: () => {
      toast.success(`${plan.name} deleted`);
      refresh();
      afterDelete?.();
    },
    onError: (e: any) =>
      toast.error("Couldn't delete the plan", {
        description: formatServerError(e),
        action:
          plan.status === "active"
            ? { label: "Archive instead", onClick: () => archive.mutate(true) }
            : undefined,
      }),
  });

  const hasLogs = (sessionCount ?? 0) > 0;
  const archived = plan.status === "archived";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${plan.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onSelect={() => navigate({ to: "/admin/plans/new", search: { editPlanId: plan.id } })}
          >
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => archive.mutate(!archived)}>
            {archived ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" /> Archive
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => duplicate.mutate()}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate as template
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={hasLogs}
            className="text-destructive focus:text-destructive"
            onSelect={() => setConfirm(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {hasLogs ? "Delete (has logged sessions)" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {plan.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Plans with logged sessions can't be deleted — archive those instead. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
