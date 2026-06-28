import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlan } from "@/lib/plans.functions";

export const Route = createFileRoute("/_authenticated/admin/plans/$planId")({
  component: PlanView,
});

function PlanView() {
  const { planId } = Route.useParams();
  const { data: plan, isLoading } = useQuery({
    queryKey: ["plan", planId],
    queryFn: () => getPlan({ data: { planId } }),
  });

  if (isLoading) return <main className="p-8"><Skeleton className="h-64 rounded-2xl" /></main>;
  if (!plan) return <main className="p-8 text-sm text-muted-foreground">Plan not found.</main>;

  return (
    <>
      <GlassHeader title={plan.name} subtitle={plan.users?.display_name ?? plan.users?.email ?? "Template"} />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <Link to="/admin/plans" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All plans
        </Link>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <Badge variant="secondary" className="capitalize">{plan.status}</Badge>
          {plan.is_template && <Badge variant="outline">Template</Badge>}
          {plan.start_date && <span className="text-sm text-muted-foreground">Starts {new Date(plan.start_date).toLocaleDateString()}</span>}
          {plan.duration_weeks && <span className="text-sm text-muted-foreground">{plan.duration_weeks} weeks</span>}
        </div>

        {plan.notes && (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground whitespace-pre-wrap">
            {plan.notes}
          </div>
        )}

        {(plan.workout_days ?? []).length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
            <ClipboardList className="h-6 w-6" /> No days yet.
          </div>
        ) : (
          <div className="space-y-4">
            {plan.workout_days.map((d: any) => (
              <div key={d.id} className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-4">
                  <h3 className="text-base font-semibold">{d.day_label}</h3>
                  <p className="text-xs text-muted-foreground">{d.workout_exercises.length} exercises</p>
                </div>
                <ul className="divide-y divide-border">
                  {d.workout_exercises.map((e: any) => (
                    <li key={e.id} className="flex items-center gap-3 p-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {e.exercises?.thumbnail_url && <img src={e.exercises.thumbnail_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.exercises?.name ?? "Exercise"}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.sets ?? "?"} × {e.reps ?? "?"}{e.rest_seconds ? ` · ${e.rest_seconds}s rest` : ""}{e.tempo ? ` · tempo ${e.tempo}` : ""}
                        </p>
                        {e.notes && <p className="text-xs italic text-muted-foreground">{e.notes}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
