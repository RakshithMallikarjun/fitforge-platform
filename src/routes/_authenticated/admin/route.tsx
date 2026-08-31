import { createFileRoute, Navigate, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AdminSidebar, SidebarBody } from "@/components/admin-sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme-provider";
import { getGymTheme } from "@/lib/gym-theme.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Gym console · FitForge" },
      { name: "description", content: "Manage members, plans, check-ins and reports for your gym." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminShell,
});

function AdminShell() {
  const { data: user, isLoading } = useCurrentUser();
  const { setTheme } = useTheme();
  const fetchTheme = useServerFn(getGymTheme);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [navOpen, setNavOpen] = useState(false);
  const { data: gymTheme } = useQuery({
    queryKey: ["gym-theme"],
    queryFn: () => fetchTheme(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (gymTheme) setTheme(gymTheme);
  }, [gymTheme, setTheme]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

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
        {/* Below md the sidebar is hidden, so nav + sign-out live here. */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 md:justify-end">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SidebarBody onNavigate={() => setNavOpen(false)} />
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-destructive">
            <LogOut className="mr-1.5 h-4 w-4" /> Log out
          </Button>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
