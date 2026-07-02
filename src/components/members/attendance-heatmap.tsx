/**
 * GitHub-style 12-week attendance heatmap for the Member 360 Attendance tab.
 */
type Entry = { check_in_at: string };

export function AttendanceHeatmap({ entries }: { entries: Entry[] }) {
  const weeks = 12;
  const days = weeks * 7;

  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Start on Sunday of (12 weeks ago from this week)
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const startDow = start.getDay();
  start.setDate(start.getDate() - startDow); // align to Sunday

  const counts = new Map<string, number>();
  for (const e of entries) {
    const d = new Date(e.check_in_at);
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: { key: string; date: Date; count: number; inRange: boolean }[] = [];
  const cursor = new Date(start);
  const totalCells = weeks * 7 + 7; // pad to full weeks
  for (let i = 0; i < totalCells; i++) {
    const key = cursor.toISOString().slice(0, 10);
    const count = counts.get(key) ?? 0;
    cells.push({ key, date: new Date(cursor), count, inRange: cursor <= end });
    cursor.setDate(cursor.getDate() + 1);
  }

  const columns: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  function shade(count: number, inRange: boolean) {
    if (!inRange) return "bg-transparent";
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-primary/30";
    if (count === 2) return "bg-primary/60";
    return "bg-primary";
  }

  const total = entries.filter((e) => new Date(e.check_in_at) >= start).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Last 12 weeks</h3>
        <span className="text-xs text-muted-foreground">{total} check-ins</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-1">
          {columns.map((col, i) => (
            <div key={i} className="flex flex-col gap-1">
              {col.map((cell) => (
                <div
                  key={cell.key}
                  title={`${cell.date.toLocaleDateString()} — ${cell.count} check-in${cell.count === 1 ? "" : "s"}`}
                  className={["h-3 w-3 rounded-sm", shade(cell.count, cell.inRange)].join(" ")}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        <span className="h-3 w-3 rounded-sm bg-muted" />
        <span className="h-3 w-3 rounded-sm bg-primary/30" />
        <span className="h-3 w-3 rounded-sm bg-primary/60" />
        <span className="h-3 w-3 rounded-sm bg-primary" />
        <span>More</span>
      </div>
    </div>
  );
}
