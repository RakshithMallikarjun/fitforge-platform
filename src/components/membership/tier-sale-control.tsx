import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { updatePlan, type MembershipPlan } from "@/lib/membership-plans.functions";
import { hasTierPrice, needsSaleConfirmation } from "@/lib/tier-sale";
import { plural } from "@/lib/copy";
import { formatServerError } from "@/lib/format-error";

export function TierSaleControl({ plan, id, onMissingPrice }: { plan: MembershipPlan; id: string; onMissingPrice?: () => void }) {
  const qc = useQueryClient();
  const update = useServerFn(updatePlan);
  const [confirm, setConfirm] = useState(false);
  const [missingPrice, setMissingPrice] = useState(false);
  const save = useMutation({
    mutationFn: (isActive: boolean) => update({ data: { id: plan.id, isActive } }),
    onMutate: async (isActive) => {
      await qc.cancelQueries({ queryKey: ["membership-plans"] });
      const previous = qc.getQueryData<MembershipPlan[]>(["membership-plans"]);
      qc.setQueryData<MembershipPlan[]>(["membership-plans"], (rows) => rows?.map((p) => p.id === plan.id ? { ...p, is_active: isActive } : p));
      return { previous };
    },
    onError: (error, _active, context) => {
      if (context?.previous) qc.setQueryData(["membership-plans"], context.previous);
      toast.error("Couldn't change sale status", { description: formatServerError(error) });
    },
    onSuccess: (_result, active) => toast.success(`${plan.name} is ${active ? "now on sale" : "no longer on sale"}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ["membership-plans"] }),
  });
  return <>
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-xs">On sale</Label>
      <Switch id={id} aria-label={`Put ${plan.name} on sale`} checked={plan.is_active} disabled={save.isPending} onCheckedChange={(active) => {
        if (active && !hasTierPrice(plan.prices)) { setMissingPrice(true); onMissingPrice?.(); return; }
        setMissingPrice(false);
        if (needsSaleConfirmation(plan, active)) setConfirm(true);
        else save.mutate(active);
      }} />
    </div>
    {missingPrice && !hasTierPrice(plan.prices) && <p role="alert" className="text-xs text-destructive">Add at least one price to put this tier on sale</p>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Stop selling {plan.name}?</AlertDialogTitle><AlertDialogDescription>{plural(plan.member_count, "member")} {plan.member_count === 1 ? "is" : "are"} on this tier. They keep their plan; new sales stop.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => save.mutate(false)}>Stop sales</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}