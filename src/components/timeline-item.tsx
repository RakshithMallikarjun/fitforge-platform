type Props = {
  timestamp: string;
  title: string;
  subtitle?: string;
  variant?: "emerald" | "sky" | "muted";
};

export function TimelineItem({ timestamp, title, subtitle, variant = "emerald" }: Props) {
  const bar =
    variant === "sky" ? "timeline-bar-sky"
    : variant === "muted" ? "timeline-bar-muted"
    : "timeline-bar-emerald";
  return (
    <div className="relative pl-6 py-2">
      <span className={bar} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{timestamp}</p>
      <p className="mt-1 text-sm font-semibold">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
