import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateMemberMembership } from "@/lib/members.functions";

const TIERS = [
  { value: "basic", label: "Basic" },
  { value: "premium", label: "Premium" },
  { value: "vip", label: "VIP" },
  { value: "trial", label: "Trial" },
];

export function EditMembershipDialog({
  open,
  onOpenChange,
  memberId,
  currentType,
  currentExpiresAt,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string;
  currentType: string | null;
  currentExpiresAt: string | null;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateMemberMembership);
  const [type, setType] = useState<string>(currentType ?? "basic");
  const [expiresAt, setExpiresAt] = useState<string>(
    currentExpiresAt ? currentExpiresAt.slice(0, 10) : "",
  );

  const mutation = useMutation({
    mutationFn: () =>
      update({
        data: {
          memberId,
          membershipType: type,
          membershipExpiresAt: expiresAt || null,
        },
      }),
    onSuccess: () => {
      toast.success("Membership updated");
      qc.invalidateQueries({ queryKey: ["member", memberId] });
      qc.invalidateQueries({ queryKey: ["members"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Update failed", { description: e?.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit membership</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Membership type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
