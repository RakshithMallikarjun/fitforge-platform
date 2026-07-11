import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateMemberMembership } from "@/lib/members.functions";

const TIERS = [
  { value: "basic", label: "Basic" },
  { value: "premium", label: "Premium" },
  { value: "vip", label: "VIP" },
  { value: "trial", label: "Trial" },
];

const CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_year", label: "Half-year (6 months)" },
  { value: "annual", label: "Annual" },
];

type Cycle = "monthly" | "quarterly" | "half_year" | "annual";

export function EditMembershipDialog({
  open,
  onOpenChange,
  memberId,
  currentType,
  currentExpiresAt,
  currentBillingCycle,
  currentPaymentAmount,
  currentPaymentDate,
  currentPaymentConfirmed,
  currentPaymentNotes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string;
  currentType: string | null;
  currentExpiresAt: string | null;
  currentBillingCycle?: string | null;
  currentPaymentAmount?: number | null;
  currentPaymentDate?: string | null;
  currentPaymentConfirmed?: boolean | null;
  currentPaymentNotes?: string | null;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateMemberMembership);
  const [type, setType] = useState<string>(currentType ?? "basic");
  const [expiresAt, setExpiresAt] = useState<string>(
    currentExpiresAt ? currentExpiresAt.slice(0, 10) : "",
  );
  const [cycle, setCycle] = useState<Cycle>((currentBillingCycle as Cycle) ?? "monthly");
  const [amount, setAmount] = useState<string>(
    currentPaymentAmount != null ? String(currentPaymentAmount) : "",
  );
  const [payDate, setPayDate] = useState<string>(
    currentPaymentDate ? currentPaymentDate.slice(0, 10) : "",
  );
  const [confirmed, setConfirmed] = useState<boolean>(!!currentPaymentConfirmed);
  const [notes, setNotes] = useState<string>(currentPaymentNotes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      update({
        data: {
          memberId,
          membershipType: type,
          membershipExpiresAt: expiresAt || null,
          billingCycle: cycle,
          lastPaymentAmount: amount === "" ? null : Number(amount),
          lastPaymentDate: payDate || null,
          paymentConfirmed: confirmed,
          paymentNotes: notes || null,
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-1.5">
            <Label>Billing cycle</Label>
            <Select value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CYCLES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Last payment amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last payment date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label htmlFor="pay-confirmed" className="cursor-pointer">Payment confirmed</Label>
            <Switch id="pay-confirmed" checked={confirmed} onCheckedChange={setConfirmed} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              maxLength={300}
              rows={3}
              placeholder="Optional (max 300 chars)"
            />
            <p className="text-xs text-muted-foreground">{notes.length}/300</p>
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
