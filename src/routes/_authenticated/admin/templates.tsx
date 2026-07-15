import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Copy, Loader2, Search } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { listPlans, bulkAssignPlan } from "@/lib/plans.functions";
import { listMembers } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/admin/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignDate, setAssignDate] = useState("");
  const [query, setQuery] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["plans", "templates"],
    queryFn: () => listPlans({ data: { templatesOnly: true } }),
  });
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => listMembers() });

  const activeMembers = useMemo(
    () => (members as any[]).filter((m) => (m.status ?? "active") === "active"),
    [members],
  );
  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeMembers;
    return activeMembers.filter((m) =>
      ((m.display_name ?? "") + " " + (m.email ?? "")).toLowerCase().includes(q),
    );
  }, [activeMembers, query]);

  const bulk = useMutation({
    mutationFn: () =>
      bulkAssignPlan({
        data: {
          planId: assignFor!,
          memberIds: Array.from(selected),
          startDate: assignDate || null,
        },
      }),
    onSuccess: (r) => {
      if (r.assigned > 0) {
        toast.success(`Template assigned to ${r.assigned} member${r.assigned === 1 ? "" : "s"}`);
      }
      if (r.errors.length > 0) {
        toast.warning(`${r.errors.length} assignment${r.errors.length === 1 ? "" : "s"} failed`, {
          description: r.errors.slice(0, 5).join("\n"),
        });
      }
      setAssignFor(null);
      setSelected(new Set());
      setAssignDate("");
      setQuery("");
      if (r.assigned > 0) navigate({ to: "/admin/plans" });
    },
    onError: (e: any) => toast.error("Bulk assign failed", { description: e?.message }),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAssign(id: string) {
    setAssignFor(id);
    setSelected(new Set());
    setAssignDate("");
    setQuery("");
  }

  return (
    <>
      <GlassHeader title="Templates" subtitle="Reusable plan blueprints" />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Plan templates</h2>
          <Button onClick={() => navigate({ to: "/admin/plans/new", search: { isTemplate: true } })}>
            + New template
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : templates.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
            <ClipboardList className="h-6 w-6" /> No templates yet.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t: any) => (
              <li
                key={t.id}
                className="cursor-pointer rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-muted/40"
                onClick={() => navigate({ to: "/admin/plans/$planId", params: { planId: t.id } })}
              >
                <Link
                  to="/admin/plans/$planId"
                  params={{ planId: t.id }}
                  className="text-base font-semibold hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.day_count} days · {t.exercise_count ?? 0} exercises{t.duration_weeks ? ` · ${t.duration_weeks} wk` : ""}
                </p>
                {t.trainer_name && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Created by: {t.trainer_name}</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={(e) => { e.stopPropagation(); openAssign(t.id); }}
                >
                  <Copy className="mr-1.5 h-4 w-4" /> Bulk assign
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={!!assignFor} onOpenChange={(v) => !v && !bulk.isPending && setAssignFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk assign template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Members</Label>
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search members…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
                {filteredMembers.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No members found.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {filteredMembers.map((m: any) => (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                          <Checkbox
                            checked={selected.has(m.id)}
                            onCheckedChange={() => toggle(m.id)}
                          />
                          <span className="flex-1 truncate text-sm">
                            {m.display_name ?? m.email}
                          </span>
                          {m.display_name && m.email && (
                            <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFor(null)} disabled={bulk.isPending}>
              Cancel
            </Button>
            <Button disabled={selected.size === 0 || bulk.isPending} onClick={() => bulk.mutate()}>
              {bulk.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Assigning…
                </>
              ) : (
                <>Assign to {selected.size} member{selected.size === 1 ? "" : "s"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
