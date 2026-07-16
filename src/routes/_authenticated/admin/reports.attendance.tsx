import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subMonths, subYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassHeader } from "@/components/glass-header";
import { BentoStatCard } from "@/components/bento-stat-card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getAttendanceReport } from "@/lib/admin-stats.functions";

export const Route = createFileRoute("/_authenticated/admin/reports/attendance")({
  component: AttendanceReportPage,
});

type Preset = "7d" | "15d" | "30d" | "6m" | "1y";

const PRESETS: { key: Preset; label: string; from: Date; to: Date }[] = [
  { key: "7d", label: "Last 7 days", from: subDays(new Date(), 6), to: new Date() },
  { key: "15d", label: "Last 15 days", from: subDays(new Date(), 14), to: new Date() },
  { key: "30d", label: "Last 30 days", from: subDays(new Date(), 29), to: new Date() },
  { key: "6m", label: "Last 6 months", from: subMonths(new Date(), 6), to: new Date() },
  { key: "1y", label: "Last 1 year", from: subYears(new Date(), 1), to: new Date() },
];

function AttendanceReportPage() {
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>("30d");
  const [range, setRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const applyPreset = (preset: Preset) => {
    const p = PRESETS.find((x) => x.key === preset)!;
    setSelectedPreset(preset);
    setRange({ from: p.from, to: p.to });
  };

  const start = format(range.from, "yyyy-MM-dd");
  const end = format(range.to, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-report", start, end],
    queryFn: () => getAttendanceReport({ data: { startDate: start, endDate: end } }),
  });

  return (
    <>
      <GlassHeader title="Attendance report" subtitle="Check-in trends across your gym" />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <div className="flex items-center justify-between">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-xl">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r: any) => r?.from && r?.to && setRange(r)}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32 rounded-[2rem]" />
            <Skeleton className="h-32 rounded-[2rem]" />
            <Skeleton className="h-32 rounded-[2rem]" />
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <BentoStatCard variant="dark" label="Total check-ins" value={data.totalCheckIns.toLocaleString()} footer="In selected range" />
              <BentoStatCard label="Unique members" value={data.uniqueMembers.toLocaleString()} footer="Distinct visitors" />
              <BentoStatCard label="Avg per day" value={data.avgPerDay.toString()} footer="Across range" />
            </section>

            <ChartCard title="Daily check-ins">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Rolling 7-day average">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rolling7" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Check-ins by hour of day">
              <ResponsiveContainer width="100%" height={Math.max(240, data.peakHours.length * 24)}>
                <BarChart data={data.peakHours} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    dataKey="hour"
                    type="category"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}
      </main>
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 text-base font-bold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}
