import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { isPlatformAdmin } from "@/lib/platform.functions";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in · Fit Foundry" },
      { name: "description", content: "Completing your Fit Foundry sign-in." },
      { property: "og:title", content: "Signing you in · Fit Foundry" },
      { property: "og:description", content: "Completing your Fit Foundry sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const checkPlatformAdmin = useServerFn(isPlatformAdmin);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errDesc =
          url.searchParams.get("error_description") ?? url.searchParams.get("error");
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

        if (errDesc) {
          setError(errDesc);
          return;
        }

        if (code) {
          // PKCE form
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            setError(friendlyAuthError(exErr, "This link is no longer valid."));
            return;
          }
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          // Implicit / hash form
          const { error: sErr } = await supabase.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          if (sErr) {
            setError(friendlyAuthError(sErr, "This link is no longer valid."));
            return;
          }
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) {
          setError("This link has expired or has already been used.");
          return;
        }

        // Recovery links land here too when the mail template points at /auth/callback.
        if (hash.get("type") === "recovery" || url.searchParams.get("type") === "recovery") {
          navigate({ to: "/reset-password", replace: true });
          return;
        }

        let platformAdmin = false;
        try {
          platformAdmin = await checkPlatformAdmin();
        } catch {
          platformAdmin = false;
        }
        if (platformAdmin) {
          navigate({ to: "/platform", replace: true });
          return;
        }

        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        const roles = (roleRows ?? []).map((r) => r.role as string);
        if (roles.includes("admin") || roles.includes("trainer")) {
          navigate({ to: "/admin", replace: true });
        } else {
          navigate({ to: "/app", replace: true });
        }
      } catch (e) {
        setError(friendlyAuthError(e, "We couldn't finish signing you in."));
      }
    })();
  }, [navigate, checkPlatformAdmin]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Fit Foundry</span>
        </Link>

        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
          {error ? (
            <>
              <h1 className="font-display text-xl font-bold tracking-tight">
                This link didn't work
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button asChild className="mt-6 h-11 w-full rounded-xl">
                <Link to="/auth">Send a new link</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold tracking-tight">Signing you in…</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                One moment while we finish setting up your session.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
