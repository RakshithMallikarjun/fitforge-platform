import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/auth/password-strength";
import { friendlyAuthError, scorePassword } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password · FitForge" },
      { name: "description", content: "Set a new password for your FitForge member account." },
      { property: "og:title", content: "Reset your FitForge password" },
      { property: "og:description", content: "Set a new password for your FitForge member account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The recovery link puts a token in the URL; the Supabase client exchanges it
  // for a short-lived session, which is what lets updateUser() set a new password.
  useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        done = true;
        setReady("ok");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        done = true;
        setReady("ok");
      } else {
        setTimeout(() => !done && setReady("invalid"), 1200);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) {
      setError(friendlyAuthError(err, "We couldn't update your password."));
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/app", replace: true });
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

        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
          <h1 className="font-display text-xl font-bold tracking-tight">Choose a new password</h1>

          {ready === "checking" && (
            <p className="mt-4 text-sm text-muted-foreground">Checking your reset link…</p>
          )}

          {ready === "invalid" && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <Button asChild className="h-11 w-full rounded-xl">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </div>
          )}

          {ready === "ok" && (
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rp-password">New password</Label>
                <Input
                  id="rp-password"
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
                <Label htmlFor="rp-confirm">Confirm new password</Label>
                <Input
                  id="rp-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" disabled={saving} className="h-11 w-full rounded-xl">
                {saving ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
