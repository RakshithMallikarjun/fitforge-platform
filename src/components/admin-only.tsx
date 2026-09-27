import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Route-level gate for admin-only gym console pages. Children are not mounted
 * (so no data is fetched and no controls render) unless the caller is an admin.
 */
export function AdminOnly({ area, children }: { area: string; children: ReactNode }) {
  const { data: me, isLoading, error } = useCurrentUser();
  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1100px] space-y-4 px-4 py-8 md:px-8">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </main>
    );
  }
  if (error || !me?.roles.includes("admin")) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-4 text-center text-sm text-muted-foreground">
        <div className="grid place-items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          {area} are only available to gym administrators.
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
