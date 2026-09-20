import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  METHOD_LABEL,
  PERIOD_LABEL,
  cancelSubscription,
  listMemberPayments,
  listMemberSubscriptions,
  refundPayment,
} from "@/lib/membership-plans.functions";
import { formatMoney } from "@/lib/format-money";
import { formatShortDate } from "@/lib/format-date";

/** Tier history and receipts for one member, with refund and cancel for admins. */
export function MemberBillingPanel({
  memberId,
  memberName,
  currency,
  canManage,
}: {
  memberId: string;
  memberName: string;
  currency: string | null | undefined;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [refundTarget, setRefundTarget] = useState<{ id: string; amount: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; plan: string } | null>(null);

  const subs = useQuery({
    queryKey: ["member-subscriptions", memberId],
    queryFn: () => listMemberSubscriptions({ data: { memberId } }),
  });
  const payments = useQuery({
    queryKey: ["member-payments", memberId],
    queryFn: () => listMemberPayments({ data: { memberId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["member-subscriptions", memberId] });
    qc.invalidateQueries({ queryKey: ["member-payments", memberId] });
    qc.invalidateQueries({ queryKey: ["member", memberId] });
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["dues"] });
    qc.invalidateQueries({ queryKey: ["dues-summary"] });
  };

  const refund = useMutation({
    mutationFn: (paymentId: string) => refundPayment({ data: { paymentId } }),
    onSuccess: (res) => {
      toast.success("Payment refunded", {
        description: res.suggest_adjust_end_date
          ? "Check their end date — this payment had already extended it."
          : undefined,
      });
      invalidate();
    },
    onError: (e: any) => toast.error("Couldn't refund", { description: e?.message }),
  });

  const cancel = useMutation({
    mutationFn: (subscriptionId: string) => cancelSubscription({ data: { subscriptionId } }),
    onSuccess: () => {
      toast.success("Membership cancelled");
      invalidate();
    },
    onError: (e: any) => toast.error("Couldn't cancel", { description: e?.message }),
  });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold tracking-tight">Membership history</h3>
        {subs.isLoading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : subs.error ? (
          <p className="mt-3 text-sm text-destructive">We couldn't load the membership history.</p>
        ) : (subs.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No tier yet — record a payment to start their membership.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {subs.data!.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                <Badge className="text-xs">{s.plan_name_snapshot}</Badge>
                <span className="text-xs text-muted-foreground">{PERIOD_LABEL[s.period]}</span>
                <span className="text-xs">
                  {formatShortDate(s.started_on)} – {formatShortDate(s.ends_on)}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{s.state}</span>
                {canManage && s.state === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    onClick={() => setCancelTarget({ id: s.id, plan: s.plan_name_snapshot })}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <h3 className="border-b border-border px-5 py-4 text-sm font-semibold tracking-tight">
          Payments
        </h3>
        {payments.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : payments.error ? (
          <p className="p-5 text-sm text-destructive">We couldn't load the payment history.</p>
        ) : (payments.data ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paid</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Covers</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data!.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{formatShortDate(p.paid_on)}</TableCell>
                  <TableCell className="text-xs">
                    {p.plan_name_snapshot}
                    <span className="text-muted-foreground">
                      {" "}
                      · {PERIOD_LABEL[p.period_snapshot]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatShortDate(p.covers_from)} – {formatShortDate(p.covers_to)}
                  </TableCell>
                  <TableCell className="text-xs font-semibold">
                    {formatMoney(p.amount, p.currency ?? currency)}
                    {p.state === "refunded" && (
                      <span className="ml-1 text-muted-foreground">(refunded)</span>
                    )}
                    {p.refund_of && <span className="ml-1 text-muted-foreground">(refund)</span>}
                  </TableCell>
                  <TableCell className="text-xs">{METHOD_LABEL[p.method]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.recorded_by_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {canManage && p.state === "recorded" && !p.refund_of && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setRefundTarget({ id: p.id, amount: p.amount })}
                      >
                        Refund
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <AlertDialog open={!!refundTarget} onOpenChange={(v) => !v && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Refund {formatMoney(refundTarget?.amount, currency)} to {memberName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The payment stays on record as refunded. You may need to adjust their end date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (refundTarget) refund.mutate(refundTarget.id);
                setRefundTarget(null);
              }}
            >
              Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {memberName}'s {cancelTarget?.plan} membership?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They keep access until their paid term ends, but it won't renew or appear in dues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelTarget) cancel.mutate(cancelTarget.id);
                setCancelTarget(null);
              }}
            >
              Cancel membership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
