import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, differenceInDays } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronRight, Plus, FileText } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAssessments } from "@/lib/assessments.functions";
import { NewAssessmentSheet } from "./new-assessment-sheet";

export function AssessmentsTab({ memberId }: { memberId: string }) {
  const fetchFn = useServerFn(listAssessments);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["assessments", memberId],
    queryFn: () => fetchFn({ data: { memberId } }),
  });
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const latest = rows[0];
  const dueDays = latest ? differenceInDays(new Date(), new Date(latest.date)) : null;
  const isDue = dueDays !== null && dueDays > 28;

  // Charts: ascending by date
  const chartData = useMemo(() => {
    return [...rows].reverse().map((r: any) => ({
      date: format(new Date(r.date), "MMM d"),
      weight: r.weight,
      body_fat_pct: r.body_fat_pct,
      bench: r.bench_1rm,
      squat: r.squat_1rm,
      deadlift: r.deadlift_1rm,
    }));
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Assessments</h3>
          {latest && (
            <p className="text-xs text-muted-foreground">
              Last recorded {format(new Date(latest.date), "PPP")} ({dueDays}d ago)
            </p>
          )}
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-lg">
          <Plus className="mr-1.5 h-4 w-4" /> New assessment
        </Button>
      </div>

      {isDue && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Due for assessment</p>
            <p className="text-xs opacity-80">It's been {dueDays} days since the last assessment.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-sm text-muted-foreground">
          <FileText className="h-6 w-6" />
          No assessments recorded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Date</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>BMI</TableHead>
                <TableHead>Body fat %</TableHead>
                <TableHead>Muscle mass</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a: any) => {
                const isOpen = expanded === a.id;
                return (
                  <Fragment key={a.id}>
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : a.id)}
                    >
                      <TableCell>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium">{format(new Date(a.date), "PP")}</TableCell>
                      <TableCell>{a.weight != null ? `${Number(a.weight).toFixed(1)} kg` : "—"}</TableCell>
                      <TableCell>{a.bmi != null ? Number(a.bmi).toFixed(1) : "—"}</TableCell>
                      <TableCell>{a.body_fat_pct != null ? `${Number(a.body_fat_pct).toFixed(1)}%` : "—"}</TableCell>
                      <TableCell>{a.muscle_mass != null ? `${Number(a.muscle_mass).toFixed(1)} kg` : "—"}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">
                        {a.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${a.id}-d`} className="bg-muted/40 hover:bg-muted/40">
                        <TableCell />
                        <TableCell colSpan={6} className="py-4">
                          <DetailGrid a={a} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length >= 2 && (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="Weight">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot />
            </LineChart>
          </ChartCard>
          <ChartCard title="Body fat %">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="body_fat_pct" stroke="hsl(var(--secondary))" strokeWidth={2} dot />
            </LineChart>
          </ChartCard>
          <ChartCard title="Strength 1RM" className="md:col-span-2">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="bench" stroke="#059669" strokeWidth={2} dot />
              <Line type="monotone" dataKey="squat" stroke="#0284c7" strokeWidth={2} dot />
              <Line type="monotone" dataKey="deadlift" stroke="#9333ea" strokeWidth={2} dot />
            </LineChart>
          </ChartCard>
        </div>
      )}

      <NewAssessmentSheet memberId={memberId} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactElement; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${className}`}>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DetailGrid({ a }: { a: any }) {
  const fields: [string, any, string?][] = [
    ["Unit system", a.unit_system],
    ["Height", a.height, "cm"],
    ["Weight", a.weight, "kg"],
    ["BMI", a.bmi],
    ["Body fat", a.body_fat_pct, "%"],
    ["Muscle mass", a.muscle_mass, "kg"],
    ["Chest", a.chest, "cm"],
    ["Waist", a.waist, "cm"],
    ["Hips", a.hips, "cm"],
    ["Arms", a.arms, "cm"],
    ["Thighs", a.thighs, "cm"],
    ["VO2 max", a.vo2_max],
    ["Resting HR", a.resting_hr, "bpm"],
    ["Blood pressure", a.blood_pressure],
    ["Flexibility", a.flexibility, "cm"],
    ["Bench 1RM", a.bench_1rm, "kg"],
    ["Squat 1RM", a.squat_1rm, "kg"],
    ["Deadlift 1RM", a.deadlift_1rm, "kg"],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3 lg:grid-cols-4">
        {fields.map(([k, v, suffix]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium">{v != null && v !== "" ? `${typeof v === "number" ? Number(v).toFixed(1) : v}${suffix ? ` ${suffix}` : ""}` : "—"}</span>
          </div>
        ))}
      </div>
      {a.notes && (
        <div className="rounded-xl bg-background p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="whitespace-pre-wrap">{a.notes}</p>
        </div>
      )}
    </div>
  );
}
