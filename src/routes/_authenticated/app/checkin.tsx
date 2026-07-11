import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dumbbell, Home } from "lucide-react";
import { selfCheckin } from "@/lib/checkin.functions";

export const Route = createFileRoute("/_authenticated/app/checkin")({
  component: CheckinPage,
});

function CheckinPage() {
  const navigate = useNavigate();
  const checkin = useServerFn(selfCheckin);

  const mutation = useMutation({
    mutationFn: (locationType: "gym" | "home") => checkin({ data: { locationType } }),
    onSuccess: () => {
      toast.success("Check-in recorded ✓");
      navigate({ to: "/app" });
    },
    onError: (e: any) => toast.error("Check-in failed", { description: e?.message }),
  });

  const disabled = mutation.isPending;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Log today's visit</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Where are you working out today?</p>
      </div>

      <div className="grid gap-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() => mutation.mutate("gym")}
          className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)] transition hover:border-primary hover:bg-accent disabled:opacity-60"
        >
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary text-2xl">
            <Dumbbell className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">🏋️ At the Gym</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gym attendance will be recorded for your trainer
            </p>
          </div>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => mutation.mutate("home")}
          className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)] transition hover:border-primary hover:bg-accent disabled:opacity-60"
        >
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary text-2xl">
            <Home className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">🏠 At Home</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Home session will be logged to your progress
            </p>
          </div>
        </button>
      </div>

      {disabled && (
        <p className="mt-6 text-center text-xs text-muted-foreground">Recording…</p>
      )}
    </main>
  );
}
