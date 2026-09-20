import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, IndianRupee, Mail, Settings2, Wallet } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  PERIOD_LABEL,
  getBillingSettings,
  getDues,
  getDuesSummary,
  sendBulkReminders,
  sendDailySummaryNow,
  sendMemberReminder,
  updateBillingSettings,
  type DuesRow,
} from "@/lib/membership-plans.functions";
import { RecordPaymentDialog } from "@/components/membership/record-payment-dialog";
import { formatMoney } from "@/lib/format-money";
import { formatShortDate } from "@/lib/format-date";

export const Route = createFileRoute("/_authenticated/admin/dues")({
  component: DuesPage,
});

type Bucket = "all" | "overdue" | "due_today" | "due_soon" | "current";

const BUCKET_LABEL: Record<Exclude<Bucket, "all">, string> = {
  overdue: "Overdue",
  due_today: "Due today",
  due_soon: "Due soon",
  current: "Current",
};

function bucketTone(bucket: DuesRow["bucket"]) {
  switch (bucket) {
    case "overdue":
      return "bg-destructive text-destructive-foreground";
    case "due_today":
      return "bg-primary text-primary-foreground";
    case "due_soon":
      return "bg-accent text-accent-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function DuesPage() {
  const qc = useQueryClient();
  const [bucket, setBucket] = useState<Bucket>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [payFor, setPayFor] = useState<{ id: string; name: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const summary = useQuery({ queryKey: ["dues-summary"], queryFn: () => getDuesSummary() });
  const dues = useQuery({
    queryKey: ["dues", bucket],
    queryFn: () => getDues({ data: { bucket } }),
  });

  const rows = dues.data ?? [];
  const selectedIds = useMemo(
    () => rows.filter((r) => selected[r.member_id]).map((r) => r.member_id),
    [rows, selected],
  );

  const remindOne = useMutation({
    mutationFn: (vars: { memberId: string; force?: boolean }) => sendMemberReminder({ data: vars }),
    onSuccess: () => {
      toast.success("Reminder sent");
      qc.invalidateQueries({ queryKey: ["dues"] });
    },
    onError: (e: any) => toast.error("Reminder not sent", { description: e?.message }),
  });

  const remindMany = useMutation({
    mutationFn: (memberIds: string[]) => sendBulkReminders({ data: { memberIds } }),
    onSuccess: (res) => {
      toast.success(`${res.sent} reminder${res.sent === 1 ? "" : "s"} sent`, {
        description: res.skipped ? `${res.skipped} skipped (recently reminded)` : undefined,
      });
      setSelected({});
      qc.invalidateQueries({ queryKey: ["dues"] });
    },
    onError: (e: any) => toast.error("Couldn't send reminders", { description: e?.message }),
  });

  const currency = summary.data?.currency;

  return (
    <>
      <GlassHeader
        title="Dues"
        subtitle="Who to chase today"
        rightExtra={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="mr-1.5 h-4 w-4" /> Reminder settings
            </Button>
            <Button
              size="sm"
              className="rounded-lg"
              disabled={selectedIds.length === 0 || remindMany.isPending}
              onClick={() => setBulkConfirm(true)}
            >
              <BellRing className="mr-1.5 h-4 w-4" />
              Remind {selectedIds.length || ""}
            </Button>
          </div>
        }
      />

      <main className="mx-auto max-w-[1280px] space-y-6 px-4 py-8 md:px-8">
        {/* Summary */}
        {summary.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : summary.error ? (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            We couldn't load the dues totals.
          </p>
        ) : !summary.data ? null : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Overdue"
              value={`${summary.data.overdue_count}`}
              sub={formatMoney(summary.data.overdue_amount, currency)}
              icon={<Wallet className="h-4 w-4 text-destructive" />}
            />
            <StatCard
              label="Due today"
              value={`${summary.data.due_today_count}`}
              sub={formatMoney(summary.data.due_today_amount, currency)}
              icon={<BellRing className="h-4 w-4 text-primary" />}
            />
            <StatCard
              label="Due soon"
              value={`${summary.data.due_soon_count}`}
              sub={formatMoney(summary.data.due_soon_amount, currency)}
              icon={<Mail className="h-4 w-4 text-primary" />}
            />
            <StatCard
              label="Collected this month"
              value={formatMoney(summary.data.collected_this_month, currency)}
              sub={`${summary.data.current_count} members current`}
              icon={<IndianRupee className="h-4 w-4 text-primary" />}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <Select value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everything due</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_today">Due today</SelectItem>
              <SelectItem value="due_soon">Due soon</SelectItem>
              <SelectItem value="current">Current</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {dues.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : dues.error ? (
            <p className="p-6 text-sm text-destructive">
              We couldn't load the dues list. Refresh to try again.
            </p>
          ) : rows.length === 0 ? (
            <div className="grid place-items-center gap-2 py-16 text-sm text-muted-foreground">
              <Wallet className="h-6 w-6" />
              Nobody to chase — everyone is paid up.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Member</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last reminded</TableHead>
                  <TableHead className="w-[180px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.subscription_id}>
                    <TableCell>
                      <Checkbox
                        checked={!!selected[r.member_id]}
                        onCheckedChange={(v) =>
                          setSelected((s) => ({ ...s, [r.member_id]: v === true }))
                        }
                        aria-label={`Select ${r.display_name ?? r.email ?? "member"}`}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-semibold">{r.display_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.plan_name}
                      <span className="text-muted-foreground"> · {PERIOD_LABEL[r.period]}</span>
                    </TableCell>
                    <TableCell className="text-xs">{formatShortDate(r.ends_on)}</TableCell>
                    <TableCell className="text-xs font-semibold">
                      {formatMoney(r.amount_due, r.currency ?? currency)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${bucketTone(r.bucket)}`}>
                        {BUCKET_LABEL[r.bucket]}
                        {r.in_grace ? " (grace)" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_reminded_at ? formatShortDate(r.last_reminded_at) : "Never"}
                      {r.reminder_count ? ` · ${r.reminder_count}` : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={remindOne.isPending}
                          onClick={() =>
                            remindOne.mutate({
                              memberId: r.member_id,
                              force: !!r.last_reminded_at,
                            })
                          }
                        >
                          Remind
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            setPayFor({
                              id: r.member_id,
                              name: r.display_name ?? r.email ?? "Member",
                            })
                          }
                        >
                          Record payment
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      {payFor && (
        <RecordPaymentDialog
          open
          onOpenChange={(v) => !v && setPayFor(null)}
          memberId={payFor.id}
          memberName={payFor.name}
        />
      )}

      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send {selectedIds.length} reminder{selectedIds.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each selected member gets an in-app message and a push notification about their dues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                remindMany.mutate(selectedIds);
                setBulkConfirm(false);
              }}
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BillingSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function BillingSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["billing-settings"],
    queryFn: () => getBillingSettings(),
    enabled: open,
  });

  const [form, setForm] = useState<{
    reminderLeadDays: string;
    graceDays: string;
    autoRemindMembers: boolean;
    adminDigestEnabled: boolean;
    dailySummaryEnabled: boolean;
    dailySummaryHour: string;
    reminderTemplate: string;
  } | null>(null);

  const state =
    form ??
    (data
      ? {
          reminderLeadDays: String(data.reminder_lead_days),
          graceDays: String(data.grace_days),
          autoRemindMembers: data.auto_remind_members,
          adminDigestEnabled: data.admin_digest_enabled,
          dailySummaryEnabled: data.daily_summary_enabled,
          dailySummaryHour: String(data.daily_summary_hour),
          reminderTemplate: data.reminder_template,
        }
      : null);

  const save = useMutation({
    mutationFn: () =>
      updateBillingSettings({
        data: {
          reminderLeadDays: Number(state!.reminderLeadDays),
          graceDays: Number(state!.graceDays),
          autoRemindMembers: state!.autoRemindMembers,
          adminDigestEnabled: state!.adminDigestEnabled,
          dailySummaryEnabled: state!.dailySummaryEnabled,
          dailySummaryHour: Number(state!.dailySummaryHour),
          reminderTemplate: state!.reminderTemplate,
        },
      }),
    onSuccess: () => {
      toast.success("Reminder settings saved");
      qc.invalidateQueries({ queryKey: ["billing-settings"] });
      qc.invalidateQueries({ queryKey: ["dues"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Couldn't save settings", { description: e?.message }),
  });

  const testEmail = useMutation({
    mutationFn: () => sendDailySummaryNow(),
    onSuccess: (res: any) => toast.success(`Summary sent to ${res?.sentTo ?? "your email"}`),
    onError: (e: any) => toast.error("Couldn't send the summary", { description: e?.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Reminders & daily summary</DialogTitle>
          <DialogDescription>
            When members are chased, and when you get the day's collection email.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !state ? (
          error ? (
            <p className="text-sm text-destructive">We couldn't load these settings.</p>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="lead">Warn this many days before due</Label>
                <Input
                  id="lead"
                  inputMode="numeric"
                  value={state.reminderLeadDays}
                  onChange={(e) => setForm({ ...state, reminderLeadDays: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="grace">Grace days after due</Label>
                <Input
                  id="grace"
                  inputMode="numeric"
                  value={state.graceDays}
                  onChange={(e) => setForm({ ...state, graceDays: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto">Remind members automatically</Label>
              <Switch
                id="auto"
                checked={state.autoRemindMembers}
                onCheckedChange={(v) => setForm({ ...state, autoRemindMembers: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="digest">Daily dues alert for staff</Label>
              <Switch
                id="digest"
                checked={state.adminDigestEnabled}
                onCheckedChange={(v) => setForm({ ...state, adminDigestEnabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="summary">Daily collection email</Label>
              <Switch
                id="summary"
                checked={state.dailySummaryEnabled}
                onCheckedChange={(v) => setForm({ ...state, dailySummaryEnabled: v })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hour">Send the email at (hour, {data?.timezone})</Label>
              <Input
                id="hour"
                inputMode="numeric"
                value={state.dailySummaryHour}
                onChange={(e) => setForm({ ...state, dailySummaryHour: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template">Reminder message</Label>
              <Textarea
                id="template"
                rows={4}
                value={state.reminderTemplate}
                onChange={(e) => setForm({ ...state, reminderTemplate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                You can use {"{member_name}"}, {"{gym_name}"}, {"{plan_name}"}, {"{due_date}"} and{" "}
                {"{amount}"}.
              </p>
            </div>
            {data?.admins?.length ? (
              <p className="text-xs text-muted-foreground">
                Summary goes to: {data.admins.map((a) => a.email).join(", ")}
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={testEmail.isPending}
              onClick={() => testEmail.mutate()}
            >
              <Mail className="mr-1.5 h-4 w-4" />
              {testEmail.isPending ? "Sending…" : "Email me today's summary"}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!state || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
