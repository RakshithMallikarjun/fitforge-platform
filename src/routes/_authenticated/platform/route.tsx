import { SupportWhatsappLink } from "@/components/support-whatsapp";
import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, LayoutDashboard, LineChart, LogOut, Megaphone, Users2, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { isPlatformAdmin } from "@/lib/platform.functions";
import { ConsoleContentSkeleton } from "@/components/console-loading";
import { isNavActive } from "@/lib/copy";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({
    meta: [
      { title: "Platform console · Fit Foundry" },
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
  { to: "/platform/ads", label: "Ads", icon: Megaphone },
  { to: "/platform/analytics", label: "Analytics", icon: LineChart },
  { to: "/platform/contacts", label: "Contacts", icon: Users2 },
  { to: "/platform/leads", label: "Leads", icon: Inbox },
];

function PlatformShell() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const checkPlatformAdmin = useServerFn(isPlatformAdmin);
  const { data: allowed, isLoading, isError, refetch } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: () => checkPlatformAdmin(),
    staleTime: 5 * 60_000,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Never flash the console before the platform-admin check resolves.
  const loading = isLoading || allowed === undefined;
  if (!loading && !allowed) return <Navigate to="/admin" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-3">
          <span className="font-display text-sm font-bold tracking-tight">
            Fit Foundry Platform
          </span>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active = isNavActive(path, item.to, item.exact);
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
          <SupportWhatsappLink
            label="Support"
            className="rounded-xl px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground"
          />
          <Button variant="ghost" size="sm" className="text-destructive" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Log out
          </Button>
        </div>
      </div>
      {isError ? (
        <main className="mx-auto max-w-[1400px] px-6 py-8" role="alert">
          <p className="text-sm text-muted-foreground">We couldn't check your platform access.</p>
          <Button variant="outline" className="mt-3" onClick={() => void refetch()}>Try again</Button>
        </main>
      ) : loading ? <ConsoleContentSkeleton /> : <Outlet />}
    </div>
  );
}
