import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjustMemberExpiry } from "@/lib/membership-plans.functions";
import { formatServerError } from "@/lib/format-error";
import { formatShortDate } from "@/lib/format-date";

export function AdjustExpiryDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  currentEndsOn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string;
  memberName: string;
  currentEndsOn: string | null;
}) {
  const qc = useQueryClient();
  const [endsOn, setEndsOn] = useState(currentEndsOn ?? "");
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: () => adjustMemberExpiry({ data: { memberId, endsOn, reason } }),
    onSuccess: () => {
      toast.success("Expiry adjusted", {
        description: `${memberName} now runs until ${formatShortDate(endsOn)}.`,
      });
      for (const k of [["member", memberId], ["members"], ["member-subscriptions"], ["member-payments"], ["dues"], ["dues-summary"], ["recent-payments"]])
        qc.invalidateQueries({ queryKey: k });
      setReason("");
      onOpenChange(false);
    },
    onError: (e) => toast.error("Couldn't adjust the expiry", { description: formatServerError(e) }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust expiry</DialogTitle>
          <DialogDescription>
            Moves {memberName}'s current membership end date without taking money. The change is
            saved in their payment history with your reason.
          </DialogDescription>
        </DialogHeader>
        {!currentEndsOn ? (
          <p className="text-sm text-muted-foreground">
            This member has no membership yet. Record a payment first.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Currently ends <span className="font-semibold text-foreground">{formatShortDate(currentEndsOn)}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="adj-date">New expiry date</Label>
              <Input id="adj-date" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-reason">Reason *</Label>
              <Textarea
                id="adj-reason"
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Gym closed for 5 days for renovation"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {currentEndsOn && (
            <Button
              onClick={() => mut.mutate()}
              disabled={!endsOn || reason.trim().length < 3 || endsOn === currentEndsOn || mut.isPending}
            >
              {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save adjustment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
