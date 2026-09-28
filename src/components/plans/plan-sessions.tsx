import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listPlanSessions } from "@/lib/plans.functions";
import { formatShortDate } from "@/lib/format-date";
import { formatServerError } from "@/lib/format-error";

function fmtSet(s: { weight: number | null; reps: number | null }) {
  if (s.weight != null && s.reps != null) return `${s.weight} × ${s.reps}`;
  if (s.reps != null) return `${s.reps} reps`;
  if (s.weight != null) return `${s.weight}`;
  return "—";
}

export function PlanSessions({ planId }: { planId: string }) {
  const fetchSessions = useServerFn(listPlanSessions);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plan-sessions", planId],
    queryFn: () => fetchSessions({ data: { planId } }),
  });

  if (isLoading) return <Skeleton className="h-20 rounded-xl" />;
  if (error)
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 p-3 text-sm">
        <span className="text-destructive">Couldn't load sessions. {formatServerError(error)}</span>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  if (!data?.length)
    return <p className="text-sm text-muted-foreground">No sessions logged yet.</p>;

  return (
    <ul className="space-y-3">
      {data.map((s) => (
        <li key={s.id} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{formatShortDate(s.date)}</p>
            {s.day_label && <span className="text-sm text-muted-foreground">· {s.day_label}</span>}
            {s.effort_rating != null && (
              <Badge variant="secondary">Effort {s.effort_rating}/10</Badge>
            )}
            {s.prs.map((p, i) => (
              <Badge key={i} className="gap-1">
                <Trophy className="h-3 w-3" /> PR {p.exercise} {p.weight}
                {p.reps ? ` × ${p.reps}` : ""}
              </Badge>
            ))}
          </div>
          {s.notes && <p className="mt-2 text-sm italic text-muted-foreground">“{s.notes}”</p>}
          <ul className="mt-3 divide-y divide-border">
            {s.exercises.map((e, i) => (
              <li key={i} className="py-2">
                <p className="text-sm font-medium">{e.name}</p>
                {e.substitutedFrom && (
                  <p className="text-xs text-muted-foreground">
                    Substituted: {e.substitutedFrom} → {e.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {e.sets.length ? e.sets.map(fmtSet).join(", ") : "Not logged"}
                </p>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function ExpandablePlanSessions({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Sessions
      </button>
      {open && (
        <div className="mt-3">
          <PlanSessions planId={planId} />
        </div>
      )}
    </div>
  );
}
