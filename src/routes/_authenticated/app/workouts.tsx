import { createFileRoute } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/workouts")({
  component: WorkoutsPage,
});

function WorkoutsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Workouts</h1>
      <div className="rounded-[2rem] border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
          <Dumbbell className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-semibold tracking-tight">Your plan, fully unpacked</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The full workout browser is coming next — for now, start today's session from the home tab.
        </p>
      </div>
    </div>
  );
}
