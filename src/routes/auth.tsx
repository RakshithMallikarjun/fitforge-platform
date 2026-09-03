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
import { PasswordStrength } from "@/components/auth/password-strength";
import { friendlyAuthError, scorePassword } from "@/lib/auth-errors";

type AuthSearch = { deactivated?: boolean; gymDisabled?: boolean };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    deactivated: search.deactivated === true || search.deactivated === "true" ? true : undefined,
    gymDisabled: search.gymDisabled === true || search.gymDisabled === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in · FitForge" },
      { name: "description", content: "Sign in to FitForge or create a member account." },
      { property: "og:title", content: "Sign in to FitForge" },
      { property: "og:description", content: "Sign in to FitForge or create a member account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

function AuthPage() {
  const { deactivated, gymDisabled } = Route.useSearch();
  const { data: user, sessionLoading, refetch } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [claimSlug, setClaimSlug] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Explicit, durable error state from the route guard (account deactivated
  // mid-session) instead of a one-shot toast that gets lost behind others.
  useEffect(() => {
    if (gymDisabled) {
      setPageError("This gym's account is currently disabled — please contact your gym.");
    } else if (deactivated) {
      setPageError("This account has been deactivated. Please contact your gym to regain access.");
    }
  }, [deactivated, gymDisabled]);


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
      if (user.primaryRole === "member") {
        navigate({ to: "/app", replace: true });
      } else {
        setPageError(
          "Your account isn't linked to a gym yet, so there's nothing to open. Ask your gym to add you, then sign in again.",
        );
      }
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
        } else {
          // Terminal branch: signed in, but we can't resolve a gym or a role.
          setPageError(
            `We couldn't match your account to the gym "${slug}". Please contact your gym so they can finish setting up your membership.`,
          );
        }
      })
      .catch((e) => {
        if (!cancelled) setPageError(friendlyAuthError(e, "We couldn't check your gym. Please try again."));
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
      toast.error(friendlyAuthError(e, "Could not claim admin"));
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

        {pageError && (
          <div className="mb-4">
            <ErrorBanner>{pageError}</ErrorBanner>
          </div>
        )}

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
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !data.user) {
      setLoading(false);
      setError(friendlyAuthError(signInErr, "We couldn't sign you in. Please try again."));
      return;
    }

    // Deactivated accounts must fail HERE — before any success feedback. The
    // _authenticated route guard stays as the backstop for mid-session changes.
    const { data: profile } = await supabase
      .from("users")
      .select("active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && profile.active === false) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("This account has been deactivated. Please contact your gym to regain access.");
      return;
    }

    // Record the sign-in on the profile row so the members page never has to
    // page through platform-wide auth users to show "last active".
    await supabase.rpc("touch_last_sign_in").then(
      () => undefined,
      () => undefined,
    );

    setLoading(false);
    toast.success("Welcome back");

  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(friendlyAuthError(err, "We couldn't send the reset email."));
      return;
    }
    setSent(true);
  }

  if (mode === "forgot") {
    return (
      <form onSubmit={onForgot} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fp-email">Email</Label>
          <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            We'll email you a link to choose a new password.
          </p>
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {sent && (
          <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary">
            If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.
          </p>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
        <button
          type="button"
          onClick={() => { setMode("signin"); setError(null); setSent(false); }}
          className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          <button
            type="button"
            onClick={() => { setMode("forgot"); setError(null); }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <Input id="signin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gymSlug, setGymSlug] = useState("fitforge");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    if (scorePassword(password).score < 2) {
      setError("Please choose a stronger password (at least 8 characters, with a mix of cases).");
      return;
    }
    setLoading(true);
    // Gym membership requires the gym's private join code, so a slug alone
    // can't be guessed to enter someone else's tenant. Validated BEFORE signUp,
    // so a wrong code never creates an account.
    const { data: valid, error: codeErr } = await supabase.rpc("verify_join_code", {
      _slug: gymSlug.trim(),
      _code: joinCode.trim(),
    });
    if (codeErr || !valid) {
      setLoading(false);
      setError("We couldn't find that gym code — check the gym code and join code with your gym.");
      if (codeErr) console.error("[auth] verify_join_code", codeErr);
      return;
    }
    // SECURITY: role is HARDCODED to "member". Public self-service sign-up must
    // never grant admin/trainer — that would be a privilege-escalation vector.
    // Legitimate paths to create staff:
    //   - claimGymAdmin (src/lib/bootstrap.functions.ts) for the very first admin of a fresh gym
    //   - inviteStaffMember (src/lib/staff.functions.ts) called from the admin-only Staff page
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName, gym_slug: gymSlug.trim(), role: "member" },
      },
    });
    setLoading(false);
    if (signUpErr) {
      setError(friendlyAuthError(signUpErr, "We couldn't create your account."));
      return;
    }
    toast.success("Account created — check your email if we ask you to confirm it.");
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
        <Input
          id="su-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrength password={password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-confirm">Confirm password</Label>
        <Input
          id="su-confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {confirm.length > 0 && confirm !== password && (
          <p className="text-xs text-destructive">Those passwords don't match.</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-gym">Gym code</Label>
        <Input id="su-gym" required value={gymSlug} onChange={(e) => setGymSlug(e.target.value)} placeholder="fitforge" />
        <p className="text-xs text-muted-foreground">Use the code your gym gave you. The demo gym is <code>fitforge</code>.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-join">Join code</Label>
        <Input id="su-join" required value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Provided by your gym" />
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
        {loading ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
