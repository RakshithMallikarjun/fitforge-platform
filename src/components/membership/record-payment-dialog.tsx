import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BILLING_PERIODS,
  METHOD_LABEL,
  PAYMENT_METHODS,
  PERIOD_LABEL,
  listPlans,
  previewPayment,
  recordPayment,
  type BillingPeriod,
  type PaymentMethod,
} from "@/lib/membership-plans.functions";
import { formatMoney } from "@/lib/format-money";
import { formatShortDate } from "@/lib/format-date";

/**
 * Recording a payment is what puts a member on a tier and moves their expiry —
 * there is no separate "set membership type" step any more.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string;
  memberName: string;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(previewPayment);

  const [planId, setPlanId] = useState<string>("");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [amount, setAmount] = useState<string>("");
  const [paidOn, setPaidOn] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const {
    data: plans,
    isLoading: plansLoading,
    error: plansError,
  } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => listPlans(),
    enabled: open,
  });

  const sellable = useMemo(
    () => (plans ?? []).filter((p) => p.is_active && p.prices.some((pr) => pr.is_enabled)),
    [plans],
  );

  const plan = sellable.find((p) => p.id === planId) ?? null;
  const enabledPeriods = useMemo(
    () =>
      BILLING_PERIODS.filter((p) => plan?.prices.some((pr) => pr.period === p && pr.is_enabled)),
    [plan],
  );
  const listPrice = plan?.prices.find((pr) => pr.period === period && pr.is_enabled)?.price ?? null;

  useEffect(() => {
    if (!open) return;
    setPlanId((cur) => cur || (sellable[0]?.id ?? ""));
  }, [open, sellable]);

  useEffect(() => {
    if (!plan) return;
    if (!enabledPeriods.includes(period) && enabledPeriods[0]) setPeriod(enabledPeriods[0]);
  }, [plan, enabledPeriods, period]);

  useEffect(() => {
    setAmount(listPrice == null ? "" : String(listPrice));
  }, [listPrice]);

  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ["payment-preview", memberId, planId, period],
    queryFn: () => preview({ data: { memberId, planId, period } }),
    enabled: open && !!planId && !!period,
  });

  const record = useMutation({
    mutationFn: (vars: {
      amount: number | undefined;
      paidOn: string | undefined;
      method: PaymentMethod;
      reference: string | undefined;
      note: string | undefined;
    }) =>
      recordPayment({
        data: {
          memberId,
          planId,
          period,
          amount: vars.amount,
          paidOn: vars.paidOn,
          method: vars.method,
          reference: vars.reference,
          note: vars.note,
        },
      }),
    onSuccess: (res) => {
      toast.success("Payment recorded", {
        description: `Covers ${formatShortDate(res.covers_from)} – ${formatShortDate(res.covers_to)}`,
      });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member", memberId] });
      qc.invalidateQueries({ queryKey: ["member-subscriptions", memberId] });
      qc.invalidateQueries({ queryKey: ["member-payments", memberId] });
      qc.invalidateQueries({ queryKey: ["dues"] });
      qc.invalidateQueries({ queryKey: ["dues-summary"] });
      onOpenChange(false);
      setReference("");
      setNote("");
    },
    onError: (e: any) => toast.error("Couldn't record the payment", { description: e?.message }),
  });

  const currency = quote?.currency ?? null;
  const amountNumber = amount.trim() === "" ? null : Number(amount);
  const amountInvalid =
    amountNumber != null && (!Number.isFinite(amountNumber) || amountNumber < 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Record payment — {memberName}</DialogTitle>
          <DialogDescription>
            This puts the member on the tier and extends their membership end date.
          </DialogDescription>
        </DialogHeader>

        {plansLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : plansError ? (
          <p className="text-sm text-destructive">
            We couldn't load your tiers. Please close this and try again.
          </p>
        ) : sellable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tier is on sale yet. Create a tier and set at least one price first.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Tier</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tier" />
                </SelectTrigger>
                <SelectContent>
                  {sellable.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Term</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as BillingPeriod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a term" />
                </SelectTrigger>
                <SelectContent>
                  {enabledPeriods.map((p) => {
                    const price = plan?.prices.find((pr) => pr.period === p)?.price ?? null;
                    return (
                      <SelectItem key={p} value={p}>
                        {PERIOD_LABEL[p]}
                        {price != null ? ` — ${formatMoney(price, currency ?? undefined)}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pay-amount">Amount collected</Label>
                <Input
                  id="pay-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={listPrice == null ? "0" : String(listPrice)}
                />
                {amountInvalid && <p className="text-xs text-destructive">Enter a valid amount.</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-date">Paid on</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {METHOD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-ref">Reference (optional)</Label>
                <Input
                  id="pay-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Receipt or UPI ref"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pay-note">Note (optional)</Label>
              <Textarea
                id="pay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>

            <div className="rounded-xl border border-border bg-accent/40 p-3 text-sm">
              {quoting && !quote ? (
                <Skeleton className="h-10 w-full" />
              ) : !quote ? (
                <p className="text-muted-foreground">Choose a tier and term to see the dates.</p>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">
                    Covers {formatShortDate(quote.covers_from)} – {formatShortDate(quote.covers_to)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {quote.is_renewal
                      ? `Renewal — currently ends ${formatShortDate(quote.previous_ends_on)}`
                      : "First payment on this tier"}
                    {quote.is_lapsed_restart
                      ? ` · lapsed ${quote.days_lapsed} day${quote.days_lapsed === 1 ? "" : "s"}, restarts today`
                      : ""}
                  </p>
                  {quote.supersedes_plan_name && (
                    <p className="text-xs text-muted-foreground">
                      Replaces their current {quote.supersedes_plan_name} membership.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!planId || amountInvalid || record.isPending || sellable.length === 0}
            onClick={() =>
              record.mutate({
                amount: amountNumber ?? undefined,
                paidOn: paidOn || undefined,
                method,
                reference: reference.trim() || undefined,
                note: note.trim() || undefined,
              })
            }
          >
            {record.isPending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
