import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Mail,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CopyButton,
  EmptyState,
  ErrorState,
  HealthBar,
  KpiCard,
  PaymentChip,
  fmtDate,
  num,
  pct,
  relTime,
} from "@/components/platform/platform-ui";
import {
  getAuditLog,
  getPlatformGymActivityTrend,
  getPlatformGymDetail,
  setGymEnabled,
  setGymPlan,
  setPaymentStatus,
  type PaymentStatus,
  type SubscriptionPlan,
} from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/gyms/$gymId")({
  component: PlatformGymDetailPage,
});

const PAYMENT_STATUSES: PaymentStatus[] = [
  "trialing",
  "paid",
  "pending",
  "overdue",
  "failed",
  "cancelled",
];
const PLANS: SubscriptionPlan[] = ["starter", "growth", "pro", "chain"];

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PlatformGymDetailPage() {
  const { gymId } = Route.useParams();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["platform-gym", gymId],
    queryFn: () => getPlatformGymDetail({ data: { gymId } }),
  });
  const trend = useQuery({
    queryKey: ["platform-gym-activity", gymId],
    queryFn: () => getPlatformGymActivityTrend({ data: { gymId, days: 30 } }),
  });
  const audit = useQuery({
    queryKey: ["platform-audit", gymId],
    queryFn: () => getAuditLog({ data: { gymId, limit: 25 } }),
  });

  const g = detail.data;

  const [toggleOpen, setToggleOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [billingOpen, setBillingOpen] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>("trialing");
  const [lastPaymentAt, setLastPaymentAt] = useState("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!g) return;
    setStatus(g.payment_status);
    setLastPaymentAt(g.last_payment_at?.slice(0, 10) ?? "");
    setNextDueAt(g.next_due_at?.slice(0, 10) ?? "");
    setAmount(g.monthly_amount != null ? String(g.monthly_amount) : "");
    setCurrency(g.currency ?? "INR");
  }, [g]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["platform-gym", gymId] });
    qc.invalidateQueries({ queryKey: ["platform-audit", gymId] });
    qc.invalidateQueries({ queryKey: ["platform-gyms"] });
    qc.invalidateQueries({ queryKey: ["platform-overview"] });
  }

  const toggleMutation = useMutation({
    mutationFn: (v: { enabled: boolean; reason?: string }) =>
      setGymEnabled({ data: { gymId, ...v } }),
    onSuccess: (_r, v) => {
      toast.success(v.enabled ? "Gym enabled" : "Gym disabled");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Could not update the gym"),
  });

  const billingMutation = useMutation({
    mutationFn: () =>
      setPaymentStatus({
        data: {
          gymId,
          status,
          lastPaymentAt: lastPaymentAt || null,
          nextDueAt: nextDueAt || null,
          monthlyAmount: amount ? Number(amount) : null,
          currency,
          note: note || null,
        },
      }),
    onSuccess: () => {
      toast.success("Billing updated");
      setBillingOpen(false);
      setNote("");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Could not update billing"),
  });

  const planMutation = useMutation({
    mutationFn: (plan: SubscriptionPlan) => setGymPlan({ data: { gymId, plan } }),
    onSuccess: () => {
      toast.success("Plan updated");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Could not update the plan"),
  });

  if (detail.isError) {
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
      </main>
    );
  }

  if (detail.isLoading || !g) {
    return (
      <main className="mx-auto max-w-[1200px] space-y-4 px-6 py-8">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </main>
    );
  }

  const trendData = trend.data ?? [];
  const hasTrend = trendData.some((d) => d.workouts + d.checkins > 0);

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 px-6 py-8">
      <Link to="/platform/gyms" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All gyms
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{g.name}</h1>
          <p className="text-xs text-muted-foreground">
            {g.slug} · {g.timezone} · joined {fmtDate(g.created_at)}
            {g.custom_domain ? ` · ${g.custom_domain}` : ""}
          </p>
          {!g.is_enabled && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
              <ShieldAlert className="h-3.5 w-3.5" />
              Disabled {relTime(g.disabled_at)}
              {g.disabled_reason ? ` — ${g.disabled_reason}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
            <Label htmlFor="gym-enabled" className="text-xs">
              Enabled
            </Label>
            <Switch
              id="gym-enabled"
              checked={g.is_enabled}
              onCheckedChange={() => {
                setReason("");
                setToggleOpen(true);
              }}
            />
          </div>
          <Select value={g.subscription_plan} onValueChange={(v) => planMutation.mutate(v as SubscriptionPlan)}>
            <SelectTrigger className="w-32 capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLANS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Members" value={`${g.active_member_count}/${g.member_count}`} hint="Active of total accounts" />
        <KpiCard label="Staff" value={`${g.admin_count} admin · ${g.trainer_count} trainer`} />
        <KpiCard label="Workouts 30d" value={g.workouts_30d} hint={`${g.workouts_7d} in the last 7 days`} />
        <KpiCard label="Check-ins 30d" value={g.checkins_30d} hint={`${g.checkins_7d} in the last 7 days`} />
        <KpiCard label="Plan coverage" value={pct(g.plan_coverage)} hint="Active members with an active plan" />
        <KpiCard label="Assessed (90d)" value={pct(g.assessed_90d_ratio)} />
        <KpiCard label="Workouts / active member" value={num(g.workouts_per_active_member_30d)} />
        <KpiCard label="Members per trainer" value={num(g.members_per_trainer)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Health">
          <HealthBar score={g.health_score} memberCount={g.member_count} />
          <p className="mt-3 text-xs text-muted-foreground">
            Last activity {g.last_activity_at ? relTime(g.last_activity_at) : "never"}
            {g.days_since_activity !== null ? ` (${g.days_since_activity}d)` : ""}. Check-in rate{" "}
            {pct(g.checkin_rate_30d)}, active ratio {pct(g.active_member_ratio)}.
          </p>
        </Section>

        <Section
          title="Billing"
          action={
            <Button size="sm" variant="outline" onClick={() => setBillingOpen(true)}>
              Update
            </Button>
          }
        >
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd><PaymentChip status={g.payment_status} /></dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">Monthly</dt>
              <dd className="font-numeric">
                {g.monthly_amount != null ? `${g.currency} ${g.monthly_amount}` : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">Last payment</dt>
              <dd>{fmtDate(g.last_payment_at)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">Next due</dt>
              <dd className={g.next_due_at && g.next_due_at < new Date().toISOString().slice(0, 10) ? "text-destructive" : ""}>
                {fmtDate(g.next_due_at)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">Billing email</dt>
              <dd className="flex items-center gap-1 truncate">
                {g.billing_email ?? "—"} <CopyButton value={g.billing_email} />
              </dd>
            </div>
          </dl>
          {g.internal_note && (
            <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">{g.internal_note}</p>
          )}
        </Section>

        <Section title="Support contact">
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {g.support_email ?? "—"} <CopyButton value={g.support_email} />
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {g.support_phone ?? "—"} <CopyButton value={g.support_phone} />
            </p>
          </div>
        </Section>
      </div>

      <Section title="Activity" >
        {trend.isError ? (
          <ErrorState message={(trend.error as Error).message} onRetry={() => trend.refetch()} />
        ) : trend.isLoading ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : !hasTrend ? (
          <EmptyState>No workouts or check-ins in the last 30 days.</EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <RTooltip />
              <Line type="monotone" dataKey="workouts" name="Workouts" stroke="hsl(var(--primary))" dot={false} />
              <Line type="monotone" dataKey="checkins" name="Check-ins" stroke="hsl(var(--secondary))" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      <Section title="Staff">
        {g.staff.length === 0 ? (
          <EmptyState>This gym has no admin or trainer accounts yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Last sign-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.staff.map((s) => (
                  <TableRow key={`${s.user_id}-${s.role}`}>
                    <TableCell className="font-medium">
                      {s.display_name ?? "—"}
                      {!s.active && <Badge variant="secondary" className="ml-2">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="capitalize text-sm">{s.role}</TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center gap-1">{s.email} <CopyButton value={s.email} /></span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.phone ? (
                        <span className="inline-flex items-center gap-1">{s.phone} <CopyButton value={s.phone} /></span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{relTime(s.last_sign_in_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Staff contacts only. Member records are never shown in the platform console.
        </p>
      </Section>

      <Section title="Audit trail">
        {audit.isError ? (
          <ErrorState message={(audit.error as Error).message} onRetry={() => audit.refetch()} />
        ) : audit.isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (audit.data ?? []).length === 0 ? (
          <EmptyState>No platform changes recorded for this gym yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{a.action.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">{a.actor_email ?? "platform admin"}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" /> {relTime(a.created_at)}
                </span>
                {a.detail && (
                  <span className="w-full truncate text-[11px] text-muted-foreground">
                    {JSON.stringify(a.detail)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Dialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{g.is_enabled ? "Disable" : "Enable"} {g.name}</DialogTitle>
            <DialogDescription>
              {g.is_enabled
                ? "Members and staff lose access and see a contact-your-gym message. Nothing is deleted and you can re-enable at any time."
                : "Access is restored immediately with all data intact."}
            </DialogDescription>
          </DialogHeader>
          {g.is_enabled && (
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-xs">Reason (required)</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleOpen(false)}>Cancel</Button>
            <Button
              variant={g.is_enabled ? "destructive" : "default"}
              disabled={(g.is_enabled && !reason.trim()) || toggleMutation.isPending}
              onClick={() => {
                toggleMutation.mutate(
                  g.is_enabled ? { enabled: false, reason: reason.trim() } : { enabled: true },
                );
                setToggleOpen(false);
              }}
            >
              {g.is_enabled ? "Disable gym" : "Enable gym"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update billing</DialogTitle>
            <DialogDescription>
              Recorded manually by the platform team — no payment gateway is connected.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Payment status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
                <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastpay" className="text-xs">Last payment</Label>
              <Input id="lastpay" type="date" value={lastPaymentAt} onChange={(e) => setLastPaymentAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nextdue" className="text-xs">Next due</Label>
              <Input id="nextdue" type="date" value={nextDueAt} onChange={(e) => setNextDueAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs">Monthly amount</Label>
              <Input id="amount" type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency" className="text-xs">Currency</Label>
              <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="note" className="text-xs">Internal note (optional)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingOpen(false)}>Cancel</Button>
            <Button disabled={billingMutation.isPending} onClick={() => billingMutation.mutate()}>
              Save billing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
