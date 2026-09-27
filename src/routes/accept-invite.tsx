import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PasswordStrength } from "@/components/auth/password-strength";
import { friendlyAuthError, scorePassword } from "@/lib/auth-errors";
import { isPlatformAdmin } from "@/lib/platform.functions";
import { getGymTheme } from "@/lib/gym-theme.functions";
import { updateMyDisplayName } from "@/lib/profile.functions";

export const Route = createFileRoute("/accept-invite")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accept your invite · Fit Foundry" },
      { name: "description", content: "Set your name and password to join your gym on Fit Foundry." },
      { property: "og:title", content: "Accept your invite · Fit Foundry" },
      {
        property: "og:description",
        content: "Set your name and password to join your gym on Fit Foundry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcceptInvitePage,
});

type Invite = {
  gymName: string | null;
  logoUrl: string | null;
  roleLabel: string;
  destination: "/platform" | "/admin" | "/app";
  displayName: string;
  email: string;
};

const EXPIRED =
  "This invite link has expired or was already used. Ask your gym to resend it, or set a password with the email it was sent to.";

function AcceptInvitePage() {
  const navigate = useNavigate();
  const checkPlatformAdmin = useServerFn(isPlatformAdmin);
  const fetchTheme = useServerFn(getGymTheme);
  const saveName = useServerFn(updateMyDisplayName);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [expired, setExpired] = useState<string | null>(null);
  const [expiredEmail, setExpiredEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const errDesc =
          hash.get("error_description") ??
          url.searchParams.get("error_description") ??
          hash.get("error") ??
          url.searchParams.get("error");
        if (errDesc) {
          setExpired(EXPIRED);
          return;
        }
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setExpired(EXPIRED);
            return;
          }
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          if (error) {
            setExpired(EXPIRED);
            return;
          }
        }
        // Drop the tokens from the address bar.
        window.history.replaceState(null, "", "/accept-invite");

        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (!user) {
          setExpired(EXPIRED);
          return;
        }

        let platform = false;
        try {
          platform = await checkPlatformAdmin();
        } catch {
          platform = false;
        }
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const roles = (roleRows ?? []).map((r) => r.role as string);
        const theme = await fetchTheme().catch(() => null);
        const { data: row } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();

        const roleLabel = roles.includes("admin")
          ? "an Admin"
          : roles.includes("trainer")
            ? "a Trainer"
            : "a Member";
        const displayName =
          (user.user_metadata?.display_name as string | undefined) ?? row?.display_name ?? "";
        setName(displayName);
        setInvite({
          gymName: theme?.name ?? null,
          logoUrl: theme?.logoUrl ?? null,
          roleLabel: platform ? "a Platform admin" : roleLabel,
          destination: platform
            ? "/platform"
            : roles.includes("admin") || roles.includes("trainer")
              ? "/admin"
              : "/app",
          displayName,
          email: user.email ?? "",
        });
      } catch (e) {
        setExpired(friendlyAuthError(e, EXPIRED));
      }
    })();
  }, [checkPlatformAdmin, fetchTheme]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) return setFormError("Please enter your name.");
    if (password.length < 8 || scorePassword(password).score < 2)
      return setFormError("Please choose a stronger password (at least 8 characters).");
    if (password !== confirm) return setFormError("The passwords don't match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { display_name: trimmed },
    });
    if (error) {
      setSaving(false);
      setFormError(friendlyAuthError(error, "We couldn't save your password."));
      return;
    }
    await saveName({ data: { displayName: trimmed } }).catch(() => undefined);
    await supabase.rpc("touch_last_sign_in").then(
      () => undefined,
      () => undefined,
    );
    navigate({ to: invite.destination, replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Fit Foundry</span>
        </Link>
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
          {expired ? (
            <div className="text-center">
              <h1 className="font-display text-xl font-bold tracking-tight">Invite link expired</h1>
              <p className="mt-2 text-sm text-muted-foreground">{expired}</p>
              <div className="mt-5 space-y-2 text-left">
                <Label htmlFor="exp-email">Your email</Label>
                <Input
                  id="exp-email"
                  type="email"
                  value={expiredEmail}
                  onChange={(e) => setExpiredEmail(e.target.value)}
                />
              </div>
              <Button asChild className="mt-4 h-11 w-full rounded-xl">
                <Link to="/auth" search={{ forgot: true, email: expiredEmail || undefined }}>
                  Set a password
                </Link>
              </Button>
            </div>
          ) : !invite ? (
            <div className="space-y-4">
              <Skeleton className="mx-auto h-14 w-14 rounded-xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="text-center">
                {invite.logoUrl && (
                  <img
                    src={invite.logoUrl}
                    alt={invite.gymName ?? "Gym logo"}
                    className="mx-auto mb-3 h-14 w-14 rounded-xl object-cover"
                  />
                )}
                <h1 className="font-display text-xl font-bold tracking-tight">
                  You've been invited{invite.gymName ? ` to ${invite.gymName}` : ""} as{" "}
                  {invite.roleLabel}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set your name and password for {invite.email}.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-name">Your name</Label>
                <Input
                  id="ai-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-pw">Password</Label>
                <Input
                  id="ai-pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <PasswordStrength password={password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-pw2">Confirm password</Label>
                <Input
                  id="ai-pw2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {formError && (
                <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              )}
              <Button type="submit" className="h-11 w-full rounded-xl" disabled={saving}>
                {saving ? "Saving…" : "Accept invite"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
