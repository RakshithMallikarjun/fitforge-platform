import { useRouterState } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

/** Public-safe chrome while protected route checks run; no protected data is rendered. */
export function ConsoleLoading() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const platform = path.startsWith("/platform");
  return (
    <div className="min-h-screen bg-background" role="status" aria-label="Loading console">
      {!platform && (
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-sidebar p-6 md:block">
          <span className="font-display text-base font-bold">Fit Foundry</span>
          <div className="mt-8 space-y-4">
            {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        </aside>
      )}
      <div className={platform ? "" : "md:pl-64"}>
        <header className="flex min-h-14 items-center gap-6 border-b border-border bg-card px-6">
          <span className="font-display text-sm font-bold">{platform ? "Fit Foundry Platform" : "Fit Foundry"}</span>
          <Skeleton className="h-6 w-32" />
        </header>
        <ConsoleContentSkeleton />
      </div>
    </div>
  );
}

export function ConsoleContentSkeleton() {
  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </main>
  );
}