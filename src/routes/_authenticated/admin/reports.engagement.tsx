import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict, format } from "date-fns";
import { ArrowUpDown, RefreshCw } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEngagementReport, type EngagementRow } from "@/lib/admin-stats.functions";

export const Route = createFileRoute("/_authenticated/admin/reports/engagement")({
  component: EngagementReportPage,
});

type SortKey = "score" | "name" | "lastWorkout" | "lastCheckIn";

function scoreClass(s: number) {
  if (s >= 70) return "bg-primary-soft text-primary";
  if (s >= 40) return "bg-secondary-soft text-secondary";
  return "bg-destructive/10 text-destructive";
}

function ago(iso: string | null) {
  if (!iso) return "—";
  try { return formatDistanceToNowStrict(new Date(iso), { addSuffix: true }); }
  catch { return "—"; }
}

function EngagementReportPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["engagement-report"],
    queryFn: () => getEngagementReport(),
  });
  const [sort, setSort] = useState<SortKey>("score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const arr = [...(data ?? [])];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort === "score") cmp = a.score - b.score;
      else if (sort === "name") cmp = (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email);
      else if (sort === "lastWorkout") cmp = (a.lastWorkout ?? "").localeCompare(b.lastWorkout ?? "");
      else cmp = (a.lastCheckIn ?? "").localeCompare(b.lastCheckIn ?? "");
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [data, sort, dir]);

  function toggle(k: SortKey) {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(k); setDir(k === "score" ? "desc" : "asc"); }
  }

  return (
    <>
      <GlassHeader title="Member engagement" subtitle="Score = workouts×3 + check-ins×2 + messages×1 (last 30 days)" />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {dataUpdatedAt
              ? `Last refreshed ${format(new Date(dataUpdatedAt), "PP p")}`
              : "Loading…"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["engagement-report"] })}
            disabled={isFetching}
          >
            <RefreshCw className={["mr-2 h-3 w-3", isFetching ? "animate-spin" : ""].join(" ")} />
            Refresh
          </Button>
        </div>
        <div className="rounded-[2rem] border border-border bg-card shadow-[var(--shadow-card)]">
          {isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : isError ? (
            <div className="space-y-4 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Could not load engagement data — please try refreshing.
              </p>
              {error instanceof Error && (
                <p className="text-xs text-destructive">{error.message}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["engagement-report"] });
                  refetch();
                }}
              >
                Retry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortBtn onClick={() => toggle("name")}>Member</SortBtn>
                  </TableHead>
                  <TableHead>
                    <SortBtn onClick={() => toggle("score")}>Score</SortBtn>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Workouts</TableHead>
                  <TableHead className="hidden md:table-cell">Check-ins</TableHead>
                  <TableHead className="hidden lg:table-cell">Messages</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <SortBtn onClick={() => toggle("lastWorkout")}>Last workout</SortBtn>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <SortBtn onClick={() => toggle("lastCheckIn")}>Last check-in</SortBtn>
                  </TableHead>
                  <TableHead>Trainer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: EngagementRow) => (
                  <TableRow key={r.memberId}>
                    <TableCell className="font-medium">
                      <Link to="/admin/members/$memberId" params={{ memberId: r.memberId }} className="hover:underline">
                        {r.displayName ?? r.email}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className={["inline-flex min-w-10 justify-center rounded-full px-2 py-0.5 text-xs font-semibold", scoreClass(r.score)].join(" ")}>
                        {r.score}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-numeric">{r.workouts30d}</TableCell>
                    <TableCell className="hidden md:table-cell font-numeric">{r.checkIns30d}</TableCell>
                    <TableCell className="hidden lg:table-cell font-numeric">{r.messages30d}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">{ago(r.lastWorkout)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">{ago(r.lastCheckIn)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.trainer ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No engagement data yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </>
  );
}

function SortBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={onClick}>
      {children} <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );
}
