import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Dumbbell, ShieldCheck, Sparkles } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitForge — White-label fitness platform" },
      { name: "description", content: "Branded member apps, trainer tools, and analytics for modern gyms." },
      { property: "og:title", content: "FitForge" },
      { property: "og:description", content: "Branded member apps, trainer tools, and analytics for modern gyms." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: user, sessionLoading } = useCurrentUser();
  const navigate = useNavigate();

  // Auto-route signed-in users to their app.
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) return;
    if (user.primaryRole === "admin" || user.primaryRole === "trainer") {
      navigate({ to: "/admin", replace: true });
    } else if (user.primaryRole === "member") {
      navigate({ to: "/app", replace: true });
    }
  }, [user, sessionLoading, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <header className="glass-header">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-8 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">FitForge</span>
          </div>
          <Link to="/auth">
            <Button variant="ghost" className="rounded-xl">Sign in</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-8 pt-20 pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            White-label · multi-tenant · PWA
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            The operating system for{" "}
            <span className="text-primary">modern gyms.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            FitForge gives gym owners a branded member app, gives trainers a programming
            toolkit, and gives members a beautifully clean place to train — all on one
            multi-tenant backbone you can fully white-label.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 rounded-xl px-6">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 rounded-xl px-6">
                Member sign in
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Dumbbell className="h-5 w-5" />}
            title="Programming made fast"
            body="Build plans, assign workouts, track every set across every member from one screen."
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Members love it"
            body="A mobile-first PWA that feels like Peloton — but lives under your gym's brand."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Multi-tenant by design"
            body="Row-level isolation between gyms, per-gym theming, and a single codebase you don't have to rebuild."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card-lift rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-5 font-display text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
