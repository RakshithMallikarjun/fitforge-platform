import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ClipboardList } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { listPlans } from "@/lib/plans.functions";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  component: PlansPage,
});

function PlansPage() {
  const navigate = useNavigate();
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans", "all"],
    queryFn: () => listPlans({ data: {} }),
  });

  const nonTemplate = plans.filter((p) => !p.is_template);

  return (
    <>
      <GlassHeader title="Workout Plans" subtitle="Programs assigned to your members" />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Plans</h2>
          <Button onClick={() => navigate({ to: "/admin/plans/new" })} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> New plan
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : nonTemplate.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
            <ClipboardList className="h-6 w-6" /> No plans yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nonTemplate.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate({ to: "/admin/plans/$planId", params: { planId: p.id } })}>
                    <TableCell>
                      <Link to="/admin/plans/$planId" params={{ planId: p.id }} className="font-medium text-primary hover:underline">{p.name}</Link>
                    </TableCell>
                    <TableCell>{p.member_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{p.status}</Badge></TableCell>
                    <TableCell>{p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{p.duration_weeks ? `${p.duration_weeks} wk` : "—"}</TableCell>
                    <TableCell className="text-right">{p.day_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  );
}
