import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/progress")({
  component: ProgressPage,
});

function ProgressPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Progress</h1>
      <div className="rounded-[2rem] border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary-soft text-secondary">
          <TrendingUp className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-semibold tracking-tight">Trends, PRs & body metrics</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Charts and personal bests will land here once you start logging workouts.
        </p>
      </div>
    </div>
  );
}
