import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Copy } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listPlans, assignPlan } from "@/lib/plans.functions";
import { listMembers } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/admin/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignMember, setAssignMember] = useState("");
  const [assignDate, setAssignDate] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["plans", "templates"],
    queryFn: () => listPlans({ data: { templatesOnly: true } }),
  });
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => listMembers() });

  const assign = useMutation({
    mutationFn: () =>
      assignPlan({ data: { planId: assignFor!, memberId: assignMember, startDate: assignDate || null } }),
    onSuccess: (r) => {
      toast.success("Template assigned");
      setAssignFor(null);
      navigate({ to: "/admin/plans/$planId", params: { planId: r.id } });
    },
    onError: (e: any) => toast.error("Assign failed", { description: e?.message }),
  });

  return (
    <>
      <GlassHeader title="Templates" subtitle="Reusable plan blueprints" />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Plan templates</h2>
          <Button onClick={() => navigate({ to: "/admin/plans/new" })}>New template</Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : templates.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
            <ClipboardList className="h-6 w-6" /> No templates yet.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <li key={t.id} className="rounded-2xl border border-border bg-card p-5">
                <Link to="/admin/plans/$planId" params={{ planId: t.id }} className="text-base font-semibold hover:underline">{t.name}</Link>
                <p className="mt-1 text-xs text-muted-foreground">{t.day_count} days{t.duration_weeks ? ` · ${t.duration_weeks} wk` : ""}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { setAssignFor(t.id); setAssignMember(""); setAssignDate(""); }}>
                  <Copy className="mr-1.5 h-4 w-4" /> Use template
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Member</Label>
              <Select value={assignMember} onValueChange={setAssignMember}>
                <SelectTrigger><SelectValue placeholder="Select a member…" /></SelectTrigger>
                <SelectContent>
                  {members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.display_name ?? m.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start date</Label>
              <Input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button disabled={!assignMember || assign.isPending} onClick={() => assign.mutate()}>
              {assign.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
