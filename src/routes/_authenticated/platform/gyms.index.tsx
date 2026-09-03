import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  EmptyState,
  ErrorState,
  HealthBar,
  PaymentChip,
  fmtDate,
  relTime,
} from "@/components/platform/platform-ui";
import { listPlatformGyms, setGymEnabled, type PlatformGymRow } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/gyms/")({
  component: PlatformGymsPage,
});

type SortKey =
  | "name"
  | "member_count"
  | "active_member_count"
  | "workouts_30d"
  | "checkins_30d"
  | "health_score"
  | "last_activity_at"
  | "next_due_at";

const PAYMENT_OPTIONS = ["all", "trialing", "paid", "pending", "overdue", "failed", "cancelled"];
const PLAN_OPTIONS = ["all", "starter", "growth", "pro", "chain"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function PlatformGymsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["platform-gyms"],
    queryFn: () => listPlatformGyms(),
  });

  const [search, setSearch] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("all");
  const [payment, setPayment] = useState("all");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState<SortKey>("health_score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [pending, setPending] = useState<{ gym: PlatformGymRow; enable: boolean } | null>(null);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (v: { gymId: string; enabled: boolean; reason?: string }) =>
      setGymEnabled({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["platform-gyms"] });
      const prev = qc.getQueryData<PlatformGymRow[]>(["platform-gyms"]);
      qc.setQueryData<PlatformGymRow[]>(["platform-gyms"], (rows) =>
        (rows ?? []).map((r) => (r.id === v.gymId ? { ...r, is_enabled: v.enabled } : r)),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["platform-gyms"], ctx.prev);
      toast.error((err as Error).message || "Could not update the gym");
    },
    onSuccess: (_r, v) => {
      toast.success(v.enabled ? "Gym enabled" : "Gym disabled");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["platform-gyms"] });
      qc.invalidateQueries({ queryKey: ["platform-overview"] });
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = (data ?? []).filter((g) => {
      if (q && !g.name.toLowerCase().includes(q) && !g.slug.toLowerCase().includes(q)) return false;
      if (enabledFilter === "enabled" && !g.is_enabled) return false;
      if (enabledFilter === "disabled" && g.is_enabled) return false;
      if (payment !== "all" && g.payment_status !== payment) return false;
      if (plan !== "all" && g.subscription_plan !== plan) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      let cmp: number;
      if (sort === "name") cmp = a.name.localeCompare(b.name);
      else if (sort === "last_activity_at" || sort === "next_due_at")
        cmp = String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""));
      else cmp = Number(a[sort] ?? 0) - Number(b[sort] ?? 0);
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [data, search, enabledFilter, payment, plan, sort, dir]);

  function toggleSort(k: SortKey) {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      setDir(k === "name" ? "asc" : "desc");
    }
  }

  function Th({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) {
    return (
      <TableHead className={right ? "text-right" : undefined}>
        <button
          className={`inline-flex items-center gap-1 ${right ? "justify-end" : ""}`}
          onClick={() => toggleSort(k)}
        >
          {children}
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        </button>
      </TableHead>
    );
  }

  function activityClass(days: number | null) {
    if (days === null) return "text-destructive";
    if (days >= 30) return "text-destructive";
    if (days >= 14) return "text-amber-600 dark:text-amber-400";
    return "text-muted-foreground";
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 px-6 py-8">
      <header>
        <h1 className="text-lg font-bold tracking-tight">Gyms</h1>
        <p className="text-xs text-muted-foreground">
          Enablement and billing state are operator-entered — no payment gateway is connected.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search gym name or slug…"
          className="w-56"
        />
        <Select value={enabledFilter} onValueChange={setEnabledFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={payment} onValueChange={setPayment}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAYMENT_OPTIONS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p === "all" ? "All payments" : p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p === "all" ? "All plans" : p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState message={(error as Error)?.message ?? "Failed to load gyms"} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState>No gyms match these filters.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <Th k="name">Gym</Th>
                <TableHead>Enabled</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Plan</TableHead>
                <Th k="member_count" right>Members</Th>
                <Th k="workouts_30d" right>Workouts 30d</Th>
                <Th k="checkins_30d" right>Check-ins 30d</Th>
                <Th k="health_score">Health</Th>
                <Th k="last_activity_at">Last activity</Th>
                <Th k="next_due_at">Next due</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link
                      to="/platform/gyms/$gymId"
                      params={{ gymId: g.id }}
                      className="font-medium hover:underline"
                    >
                      {g.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">{g.slug}</p>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={g.is_enabled}
                      aria-label={`Toggle ${g.name}`}
                      onCheckedChange={(next) => {
                        setReason("");
                        setPending({ gym: g, enable: next });
                      }}
                    />
                  </TableCell>
                  <TableCell><PaymentChip status={g.payment_status} /></TableCell>
                  <TableCell className="capitalize text-sm">{g.subscription_plan}</TableCell>
                  <TableCell className="font-numeric text-right text-sm">
                    {g.active_member_count}/{g.member_count}
                  </TableCell>
                  <TableCell className="font-numeric text-right text-sm">{g.workouts_30d}</TableCell>
                  <TableCell className="font-numeric text-right text-sm">{g.checkins_30d}</TableCell>
                  <TableCell><HealthBar score={g.health_score} memberCount={g.member_count} /></TableCell>
                  <TableCell className={`text-xs ${activityClass(g.days_since_activity)}`}>
                    {g.last_activity_at ? relTime(g.last_activity_at) : "never"}
                  </TableCell>
                  <TableCell
                    className={`text-xs ${
                      g.next_due_at && g.next_due_at < todayStr()
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {fmtDate(g.next_due_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.enable ? "Enable" : "Disable"} {pending?.gym.name}
            </DialogTitle>
            <DialogDescription>
              {pending?.enable
                ? "Members and staff of this gym regain access immediately. No data was lost while it was disabled."
                : "Everyone at this gym is signed out on their next navigation and shown a contact-your-gym message. Nothing is deleted and this is reversible."}
            </DialogDescription>
          </DialogHeader>
          {!pending?.enable && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="disable-reason">
                Reason (required)
              </label>
              <Textarea
                id="disable-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Non-payment after two reminders"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={pending?.enable ? "default" : "destructive"}
              disabled={(!pending?.enable && !reason.trim()) || mutation.isPending}
              onClick={() => {
                if (!pending) return;
                mutation.mutate({
                  gymId: pending.gym.id,
                  enabled: pending.enable,
                  reason: pending.enable ? undefined : reason.trim(),
                });
                setPending(null);
              }}
            >
              {pending?.enable ? "Enable gym" : "Disable gym"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
