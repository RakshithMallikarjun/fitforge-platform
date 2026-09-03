import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LayoutDashboard, LineChart, LogOut, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { isPlatformAdmin } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({
    meta: [
      { title: "Platform console · FitForge" },
      {
        name: "description",
        content: "Site-owner console: all gyms, enablement, billing state and platform analytics.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlatformShell,
});

const NAV = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/platform/gyms", label: "Gyms", icon: Building2 },
  { to: "/platform/analytics", label: "Analytics", icon: LineChart },
  { to: "/platform/contacts", label: "Contacts", icon: Users2 },
];

function PlatformShell() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: allowed, isLoading } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: () => isPlatformAdmin(),
    staleTime: 5 * 60_000,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Never flash the console before the platform-admin check resolves.
  if (isLoading || allowed === undefined) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking platform access…
      </div>
    );
  }
  if (!allowed) return <Navigate to="/admin" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-3">
          <span className="font-display text-sm font-bold tracking-tight">FitForge Platform</span>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active = item.exact ? path === item.to : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-primary"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Log out
          </Button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
