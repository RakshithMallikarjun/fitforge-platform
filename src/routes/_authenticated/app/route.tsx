import { createFileRoute, Link, Navigate, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Dumbbell, Home, LogOut, MessageSquare, User } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme-provider";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { registerSW } from "@/lib/pwa/register-sw";
import { unreadCount } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/app")({
  component: MemberShell,
});

const NAV: ReadonlyArray<{ to: "/app" | "/app/workouts" | "/app/progress" | "/app/messages" | "/app/profile"; label: string; icon: typeof Home; exact?: boolean; badgeKey?: "unread" }> = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/app/progress", label: "Progress", icon: Activity },
  { to: "/app/messages", label: "Messages", icon: MessageSquare, badgeKey: "unread" },
  { to: "/app/profile", label: "Profile", icon: User },
];


function MemberShell() {
  const { data: user, isLoading } = useCurrentUser();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme } = useTheme();

  useEffect(() => {
    void registerSW();
  }, []);

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
    <div className="min-h-screen bg-background pb-24" style={{ paddingBottom: "max(6rem, env(safe-area-inset-bottom))" }}>
      <header className="glass-header" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-5">
          <div className="flex items-center gap-2">
            {theme.logoUrl ? (
              <img src={theme.logoUrl} alt={theme.name} className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Dumbbell className="h-4 w-4" />
              </div>
            )}
            <span className="font-display text-base font-bold tracking-tight">{theme.name}</span>
          </div>
          <button onClick={signOut} aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6">
        <Outlet />
      </main>

      <InstallPrompt />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={[
                  "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors",
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
