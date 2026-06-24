import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  footer?: ReactNode;
  variant?: "default" | "dark";
};

export function BentoStatCard({ label, value, footer, variant = "default" }: Props) {
  if (variant === "dark") {
    return (
      <div className="bento-emerald card-lift">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/70">{label}</p>
        <p className="font-numeric mt-3 text-2xl font-bold">{value}</p>
        {footer && <div className="mt-3 text-xs text-primary-foreground/80">{footer}</div>}
      </div>
    );
  }
  return (
    <div className="card-lift rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="font-numeric mt-3 text-2xl font-bold">{value}</p>
      {footer && <div className="mt-3 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}
