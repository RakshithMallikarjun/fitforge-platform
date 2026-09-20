import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArrowDown, ArrowUp, Layers, Pencil, Plus, Sparkles } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  BILLING_PERIODS,
  PERIOD_LABEL,
  archivePlan,
  createPlan,
  listPlans,
  removePlanPrice,
  reorderPlans,
  seedStarterPlans,
  setPlanPrice,
  updatePlan,
  type MembershipPlan,
} from "@/lib/membership-plans.functions";
import { formatMoney } from "@/lib/format-money";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/admin/membership-plans")({
  component: MembershipPlansPage,
});

function MembershipPlansPage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.roles.includes("admin");

  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<MembershipPlan | null>(null);

  const {
    data: plans,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => listPlans(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["membership-plans"] });
  };

  const seed = useMutation({
    mutationFn: () => seedStarterPlans(),
    onSuccess: () => {
      toast.success("Bronze, Silver and Gold created — add your prices");
      invalidate();
    },
    onError: (e: any) =>
      toast.error("Couldn't create the starter tiers", { description: e?.message }),
  });

  const archive = useMutation({
    mutationFn: (id: string) => archivePlan({ data: { id } }),
    onSuccess: () => {
      toast.success("Tier archived");
      invalidate();
    },
    onError: (e: any) => toast.error("Couldn't archive the tier", { description: e?.message }),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderPlans({ data: { ids } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error("Couldn't reorder", { description: e?.message }),
  });

  const live = (plans ?? []).filter((p) => !p.archived_at);
  const archived = (plans ?? []).filter((p) => p.archived_at);

  function move(index: number, dir: -1 | 1) {
    const ids = live.map((p) => p.id);
    const to = index + dir;
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const moved = next[index]!;
    next[index] = next[to]!;
    next[to] = moved;
    reorder.mutate(next);
  }

  return (
    <>
      <GlassHeader
        title="Membership tiers"
        subtitle="Your gym's plans, prices and terms"
        rightExtra={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              {live.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={seed.isPending}
                  onClick={() => seed.mutate()}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" /> Start with Bronze / Silver / Gold
                </Button>
              )}
              <Button size="sm" className="rounded-lg" onClick={() => setCreating(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> New tier
              </Button>
            </div>
          ) : null
        }
      />

      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            We couldn't load your tiers. Refresh the page to try again.
          </p>
        ) : live.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-card py-16 text-center">
            <Layers className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tiers yet. Create one, or start from Bronze / Silver / Gold.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {live.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                canEdit={!!isAdmin}
                onEdit={() => setEditing(plan)}
                onArchive={() => setArchiveTarget(plan)}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                first={i === 0}
                last={i === live.length - 1}
              />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Archived</h2>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {archived.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.member_count} active member{p.member_count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {(creating || editing) && (
        <PlanDialog
          plan={editing}
          open
          onOpenChange={(v) => {
            if (!v) {
              setCreating(false);
              setEditing(null);
            }
          }}
        />
      )}

      <AlertDialog open={!!archiveTarget} onOpenChange={(v) => !v && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.member_count
                ? `${archiveTarget.member_count} member(s) stay on this tier until their term ends, but you can't sell it again.`
                : "You won't be able to sell this tier any more. Past payments are kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveTarget) archive.mutate(archiveTarget.id);
                setArchiveTarget(null);
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlanCard({
  plan,
  canEdit,
  onEdit,
  onArchive,
  onUp,
  onDown,
  first,
  last,
}: {
  plan: MembershipPlan;
  canEdit: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onUp: () => void;
  onDown: () => void;
  first: boolean;
  last: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const savePrice = useMutation({
    mutationFn: (vars: {
      period: (typeof BILLING_PERIODS)[number];
      price: number;
      isEnabled: boolean;
    }) => setPlanPrice({ data: { planId: plan.id, ...vars } }),
    onSuccess: () => {
      toast.success("Price saved");
      qc.invalidateQueries({ queryKey: ["membership-plans"] });
    },
    onError: (e: any) => toast.error("Couldn't save the price", { description: e?.message }),
  });

  const clearPrice = useMutation({
    mutationFn: (period: (typeof BILLING_PERIODS)[number]) =>
      removePlanPrice({ data: { planId: plan.id, period } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership-plans"] }),
    onError: (e: any) => toast.error("Couldn't remove the price", { description: e?.message }),
  });

  return (
    <article className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              style={plan.badge_color ? { backgroundColor: plan.badge_color } : undefined}
              className="text-xs"
            >
              {plan.name}
            </Badge>
            {!plan.is_active && <span className="text-xs text-muted-foreground">Not on sale</span>}
            {plan.hides_ads && <span className="text-xs text-muted-foreground">Ad-free</span>}
          </div>
          {plan.description && (
            <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.member_count} active member{plan.member_count === 1 ? "" : "s"}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" disabled={first} onClick={onUp} title="Move up">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={last} onClick={onDown} title="Move down">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit tier">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onArchive} title="Archive tier">
              <Archive className="h-4 w-4" />
            </Button>
          </div>
        )}
      </header>

      {plan.features.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {plan.features.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        {BILLING_PERIODS.map((period) => {
          const row = plan.prices.find((p) => p.period === period);
          const value = draft[period] ?? (row ? String(row.price) : "");
          return (
            <div key={period} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">
                {PERIOD_LABEL[period]}
              </span>
              {canEdit ? (
                <>
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    placeholder="Not sold"
                    value={value}
                    onChange={(e) => setDraft((d) => ({ ...d, [period]: e.target.value }))}
                    onBlur={() => {
                      const raw = (draft[period] ?? "").trim();
                      if (draft[period] === undefined) return;
                      if (raw === "") {
                        if (row) clearPrice.mutate(period);
                        setDraft((d) => {
                          const { [period]: _drop, ...rest } = d;
                          return rest;
                        });
                        return;
                      }
                      const n = Number(raw);
                      if (!Number.isFinite(n) || n < 0) {
                        toast.error("Enter a valid price");
                        return;
                      }
                      if (row && n === row.price) return;
                      savePrice.mutate({ period, price: n, isEnabled: row?.is_enabled ?? true });
                    }}
                  />
                  <Switch
                    checked={!!row?.is_enabled}
                    disabled={!row}
                    onCheckedChange={(v) =>
                      row && savePrice.mutate({ period, price: row.price, isEnabled: v })
                    }
                    aria-label={`Sell ${PERIOD_LABEL[period]}`}
                  />
                </>
              ) : (
                <span className="text-sm">
                  {row?.is_enabled ? formatMoney(row.price, plan.currency) : "Not sold"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function PlanDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: MembershipPlan | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [features, setFeatures] = useState((plan?.features ?? []).join("\n"));
  const [badgeColor, setBadgeColor] = useState(plan?.badge_color ?? "#64748b");
  const [hidesAds, setHidesAds] = useState(plan?.hides_ads ?? false);
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);

  const payload = () => ({
    name: name.trim(),
    description: description.trim() || null,
    features: features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 20),
    badgeColor,
    hidesAds,
    isActive,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (plan) await updatePlan({ data: { id: plan.id, ...payload() } });
      else await createPlan({ data: payload() });
    },
    onSuccess: () => {
      toast.success(plan ? "Tier updated" : "Tier created");
      qc.invalidateQueries({ queryKey: ["membership-plans"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Couldn't save the tier", { description: e?.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "New tier"}</DialogTitle>
          <DialogDescription>
            Name, perks and badge colour. Prices are set on the tier card.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="tier-name">Name</Label>
            <Input
              id="tier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gold"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tier-desc">Description</Label>
            <Textarea
              id="tier-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tier-features">Perks (one per line)</Label>
            <Textarea
              id="tier-features"
              rows={4}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder={"Unlimited classes\nPersonal trainer"}
            />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="tier-color">Badge colour</Label>
            <input
              id="tier-color"
              type="color"
              className="h-9 w-14 rounded-md border border-border bg-background"
              value={badgeColor}
              onChange={(e) => setBadgeColor(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="tier-ads">Hide sponsor ads for these members</Label>
            <Switch id="tier-ads" checked={hidesAds} onCheckedChange={setHidesAds} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="tier-active">On sale</Label>
            <Switch id="tier-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save tier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
