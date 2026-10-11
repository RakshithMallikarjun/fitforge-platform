import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getOverloadReadiness,
  saveApprovedSuggestion,
  suggestOverload,
  type ExerciseSuggestion,
} from "@/lib/overload.functions";
import { formatServerError } from "@/lib/format-error";

/**
 * Next-week targets from the member's last 4 weeks of logs. Approve sends the
 * target to the member's Home as a "Trainer tip" (needs a saved plan); without a
 * plan id the trainer can only apply it to the draft being built.
 */
export function OverloadSuggestions({
  memberId,
  exerciseIds,
  planId,
  onApply,
}: {
  memberId: string;
  exerciseIds: string[];
  planId?: string | null;
  onApply?: (exerciseId: string, weight: number | null, reps: number | null) => void;
}) {
  const qc = useQueryClient();
  const readyFn = useServerFn(getOverloadReadiness);
  const suggestFn = useServerFn(suggestOverload);
  const approveFn = useServerFn(saveApprovedSuggestion);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [approved, setApproved] = useState<string[]>([]);

  const readiness = useQuery({
    queryKey: ["overload-readiness", memberId],
    queryFn: () => readyFn({ data: { memberId } }),
  });

  const mutation = useMutation({
    mutationFn: () => suggestFn({ data: { memberId, exerciseIds, planId: planId ?? undefined } }),
    onSuccess: () => setDismissed([]),
    onError: (e) => toast.error("Suggestions failed", { description: formatServerError(e) }),
  });

  const approve = useMutation({
    mutationFn: (s: ExerciseSuggestion) =>
      approveFn({
        data: {
          planId: planId!,
          memberId,
          exerciseId: s.exerciseId,
          suggestion: {
            suggestedWeight: s.suggestedWeight,
            suggestedReps: s.suggestedReps,
            reasoning: s.reasoning,
          },
        },
      }),
    onSuccess: (_r, s) => {
      setApproved((a) => [...a, s.exerciseId]);
      qc.invalidateQueries({ queryKey: ["member-tip"] });
      toast.success("Sent to the member as a Trainer tip");
    },
    onError: (e) => toast.error("Couldn't approve", { description: formatServerError(e) }),
  });

  const sessions = readiness.data?.sessions ?? 0;
  const blocker =
    exerciseIds.length === 0
      ? "Add exercises to this plan first."
      : readiness.isLoading
        ? null
        : readiness.error
          ? "Couldn't check this member's recent sessions."
          : sessions === 0
            ? "Log at least one session in the last 4 weeks."
            : null;

  const suggestions = (mutation.data ?? []).filter((s) => !dismissed.includes(s.exerciseId));

  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Sparkles className="h-4 w-4 text-primary" /> AI suggestions
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Next-week targets based on the member's last 4 weeks of logs.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        disabled={!!blocker || readiness.isLoading || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Analyzing…" : mutation.data ? "Refresh" : "Generate suggestions"}
      </Button>
      {readiness.isLoading ? (
        <Skeleton className="mt-2 h-3 w-2/3" />
      ) : blocker ? (
        <p className="mt-2 text-xs text-muted-foreground">{blocker}</p>
      ) : !planId && !onApply ? null : !planId ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Save the plan to send approved targets to the member.
        </p>
      ) : null}

      {mutation.data && suggestions.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">All suggestions dismissed.</p>
      )}
      {suggestions.length > 0 && (
        <ul className="mt-4 space-y-2">
          {suggestions.map((s) => {
            const isApproved = approved.includes(s.exerciseId);
            const hasTarget = s.suggestedWeight != null || s.suggestedReps != null;
            return (
              <li key={s.exerciseId} className="rounded-xl border border-border bg-background p-3 text-xs">
                <p className="text-sm font-semibold text-foreground">{s.exerciseName}</p>
                <p className="mt-0.5 text-muted-foreground">
                  Current best:{" "}
                  {s.currentBest ? `${s.currentBest.weight} kg × ${s.currentBest.reps}` : "—"}
                </p>
                {hasTarget && (
                  <p className="mt-0.5 font-medium text-primary">
                    Next target: {s.suggestedWeight ?? "—"} kg × {s.suggestedReps ?? "—"}
                  </p>
                )}
                <p className="mt-1 italic text-muted-foreground">{s.reasoning}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {hasTarget && planId && (
                    <Button
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={isApproved || approve.isPending}
                      onClick={() => approve.mutate(s)}
                    >
                      <Check className="h-3 w-3" /> {isApproved ? "Approved" : "Approve"}
                    </Button>
                  )}
                  {hasTarget && onApply && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => onApply(s.exerciseId, s.suggestedWeight, s.suggestedReps)}
                    >
                      Apply to plan
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => setDismissed((d) => [...d, s.exerciseId])}
                  >
                    <X className="h-3 w-3" /> Dismiss
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
