import { Bell, Search } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  initials?: string;
  rightExtra?: ReactNode;
};

export function GlassHeader({ title, subtitle, initials = "FF", rightExtra }: Props) {
  return (
    <header className="glass-header">
      <div className="flex h-18 items-center justify-between gap-4 px-8 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search members, plans…"
            />
          </div>
          <button className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          </button>
          {rightExtra}
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
