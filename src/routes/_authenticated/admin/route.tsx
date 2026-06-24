import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AdminSidebar } from "@/components/admin-sidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminShell,
});

function AdminShell() {
  const { data: user, isLoading } = useCurrentUser();

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
