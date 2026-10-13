import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getJobRuns } from "@/lib/platform.functions";
import { formatAuditTimestamp } from "@/lib/audit-summary";
import { plural, sentenceCase } from "@/lib/copy";

const JOB_LABEL: Record<string, string> = {
  daily_summary: "Daily collection email",
  dues_digest: "Dues alert and member reminders",
};

export function JobsPanel({ gymId }: { gymId: string }) {
  const fetchRuns = useServerFn(getJobRuns);
  const q = useQuery({
    queryKey: ["platform-job-runs", gymId],
    queryFn: () => fetchRuns({ data: { gymId } }),
    refetchInterval: 60_000,
  });
  if (q.isLoading) return <Skeleton className="h-28 rounded-xl" />;
  if (q.isError)
    return (
      <div className="text-sm text-destructive" role="alert">
        Couldn't load scheduled jobs.{" "}
        <Button variant="link" size="sm" onClick={() => q.refetch()}>
          Retry
        </Button>
      </div>
    );
  const d = q.data;
  return (
    <div className="space-y-4 text-sm">
      {!d || d.runs.length === 0 ? (
        <p className="text-muted-foreground">The scheduler hasn't run yet. It runs every 15 minutes.</p>
      ) : (
        <ul className="divide-y divide-border">
          {d.runs.map((r) => (
            <li key={r.job} className="py-2">
              <p className="font-medium">{JOB_LABEL[r.job] ?? sentenceCase(r.job)}</p>
              <p className="text-xs text-muted-foreground">
                Last run {formatAuditTimestamp(r.started_at)} · {plural(r.gyms_processed, "gym")} processed ·{" "}
                {plural(r.sent_count, "send")}
                {r.gym_result?.reason ? ` · this gym: ${sentenceCase(r.gym_result.reason)}` : r.gym_result?.outcome ? ` · this gym: ${sentenceCase(r.gym_result.outcome)}` : ""}
              </p>
              {r.error && <p className="mt-1 text-xs text-destructive">Error: {r.error}</p>}
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="text-xs font-semibold">Daily collection email — last 7 days</p>
        {d?.summary_log.length ? (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {d.summary_log.map((l) => (
              <li key={l.date}>
                {l.date}:{" "}
                {l.skipped_reason
                  ? `Skipped — ${l.skipped_reason.replace(/_/g, " ")}`
                  : `Sent to ${plural(l.recipients, "recipient")} at ${formatAuditTimestamp(l.sent_at)}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Nothing logged yet.</p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold">Dues alert — last 7 days</p>
        {d?.digest_log.length ? (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {d.digest_log.map((l) => (
              <li key={l.date}>
                {l.date}:{" "}
                {l.skipped_reason
                  ? `Skipped — ${l.skipped_reason.replace(/_/g, " ")}`
                  : `${plural(l.pushed, "staff alert")}, ${plural(l.reminded, "member reminder")}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Nothing logged yet.</p>
        )}
      </div>
    </div>
  );
}
