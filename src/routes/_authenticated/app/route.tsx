import { createFileRoute, Link, Navigate, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Calendar, Dumbbell, Home, LogOut, User } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  component: MemberShell,
});

type NavItem = { to: "/app"; label: string; icon: typeof Home; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app", label: "Workouts", icon: Dumbbell },
  { to: "/app", label: "Schedule", icon: Calendar },
  { to: "/app", label: "Progress", icon: Activity },
  { to: "/app", label: "You", icon: User },
];

function MemberShell() {
  const { data: user, isLoading } = useCurrentUser();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (user && user.primaryRole && user.primaryRole !== "member") {
    return <Navigate to="/admin" replace />;
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="glass-header">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Dumbbell className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-bold tracking-tight">FitForge</span>
          </div>
          <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6">
        <Outlet />
      </main>

      {/* bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={[
                  "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
