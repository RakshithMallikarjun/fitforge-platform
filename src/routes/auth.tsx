import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dumbbell, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { claimGymAdmin, gymHasAdmin } from "@/lib/bootstrap.functions";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · FitForge" },
      { name: "description", content: "Sign in to FitForge or create a member account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { data: user, sessionLoading, refetch } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [claimSlug, setClaimSlug] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("ff_deactivated") === "1") {
      window.sessionStorage.removeItem("ff_deactivated");
      toast.error("Your account has been deactivated", {
        description: "Please contact your gym.",
      });
    }
  }, []);

  // After a signed-in user lands here, check if their gym is unclaimed.
  // If so, offer the claim banner BEFORE redirecting — even if they already
  // have a member role (common case: first user signed up as member by default).
  useEffect(() => {
    if (sessionLoading || !user) return;
    const isStaff = user.roles.includes("admin") || user.roles.includes("trainer");
    if (isStaff) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    const slug = (user.session.user.user_metadata as any)?.gym_slug as string | undefined;
    if (!slug) {
      if (user.primaryRole === "member") navigate({ to: "/app", replace: true });
      return;
    }
    let cancelled = false;
    setChecking(true);
    gymHasAdmin({ data: { gymSlug: slug } })
      .then((res) => {
        if (cancelled) return;
        if (res.gymExists && !res.hasAdmin) {
          setClaimSlug(slug);
        } else if (user.primaryRole === "member") {
          navigate({ to: "/app", replace: true });
        }
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [user, sessionLoading, navigate]);

  async function onClaim() {
    if (!claimSlug) return;
    if (!claimToken.trim()) {
      toast.error("Enter the bootstrap token from your gym operator");
      return;
    }
    setClaiming(true);
    try {
      await claimGymAdmin({ data: { gymSlug: claimSlug, bootstrapToken: claimToken.trim() } });
      toast.success("You're now the gym admin");
      await qc.invalidateQueries({ queryKey: ["current-user"] });
      await refetch();
      navigate({ to: "/admin", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not claim admin");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">FitForge</span>
        </Link>

        {claimSlug && (
          <div className="mb-4 rounded-2xl border border-primary/30 bg-accent p-4">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Bootstrap</span>
            </div>
            <p className="mt-2 text-sm">
              No admin exists for <strong>{claimSlug}</strong> yet — enter your bootstrap token to claim Admin access.
            </p>
            <Input
              type="password"
              autoComplete="off"
              placeholder="Bootstrap token"
              value={claimToken}
              onChange={(e) => setClaimToken(e.target.value)}
              className="mt-3 h-10 rounded-xl"
            />
            <Button onClick={onClaim} disabled={claiming} className="mt-3 h-10 w-full rounded-xl">
              {claiming ? "Claiming…" : "Claim Admin"}
            </Button>
          </div>
        )}

        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-6">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <SignUpForm />
            </TabsContent>
          </Tabs>
          {checking && <p className="mt-3 text-center text-xs text-muted-foreground">Checking gym…</p>}
        </div>
      </div>
    </main>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input id="signin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gymSlug, setGymSlug] = useState("fitforge");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // SECURITY: role is HARDCODED to "member". Public self-service sign-up must
    // never grant admin/trainer — that would be a privilege-escalation vector.
    // Legitimate paths to create staff:
    //   - claimGymAdmin (src/lib/bootstrap.functions.ts) for the very first admin of a fresh gym
    //   - inviteStaffMember (src/lib/staff.functions.ts) called from the admin-only Staff page
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName, gym_slug: gymSlug, role: "member" },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Account created — you're in.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="su-name">Name</Label>
        <Input id="su-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-password">Password</Label>
        <Input id="su-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-gym">Gym code</Label>
        <Input id="su-gym" required value={gymSlug} onChange={(e) => setGymSlug(e.target.value)} placeholder="fitforge" />
        <p className="text-xs text-muted-foreground">Use the code your gym gave you. The demo gym is <code>fitforge</code>.</p>
      </div>
      <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
        {loading ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
