import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AdminSidebar } from "@/components/admin-sidebar";
import { useTheme } from "@/lib/theme-provider";
import { getGymTheme } from "@/lib/gym-theme.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminShell,
});

function AdminShell() {
  const { data: user, isLoading } = useCurrentUser();
  const { setTheme } = useTheme();
  const fetchTheme = useServerFn(getGymTheme);
  const { data: gymTheme } = useQuery({
    queryKey: ["gym-theme"],
    queryFn: () => fetchTheme(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (gymTheme) setTheme(gymTheme);
  }, [gymTheme, setTheme]);

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (user && user.primaryRole !== "admin" && user.primaryRole !== "trainer") {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="md:pl-64">
        <Outlet />
      </div>
    </div>
  );
}
