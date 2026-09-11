import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";

type Props = {
  title: string;
  subtitle?: string;
  /** Real page actions. The header itself no longer renders decorative controls. */
  rightExtra?: ReactNode;
};

export function GlassHeader({ title, subtitle, rightExtra }: Props) {
  const { data: me } = useCurrentUser();
  const initials = (me?.displayName ?? me?.email ?? "FF").slice(0, 2).toUpperCase();

  return (
    <header className="glass-header">
      <div className="flex min-h-18 flex-wrap items-center justify-between gap-3 px-4 py-4 md:flex-nowrap md:px-8">
        <div className="min-w-0 flex-1 basis-full md:basis-auto">
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:justify-end">
          {rightExtra}
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            title={me?.displayName ?? me?.email ?? undefined}
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
