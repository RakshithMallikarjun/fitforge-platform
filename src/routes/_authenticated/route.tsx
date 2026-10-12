import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGymTheme } from "@/lib/gym-theme.functions";
import { supabase } from "@/integrations/supabase/client";
import { registerSW } from "@/lib/pwa/register-sw";
import { checkGymPaused } from "@/lib/gym-pause";
import { ConsoleLoading } from "@/components/console-loading";

/** Survives the sign-out navigation race so /auth can explain what happened. */
function noteAuthReason(reason: "deactivated" | "gymDisabled") {
  try {
    sessionStorage.setItem("auth-notice", reason);
  } catch {
    /* storage unavailable */
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: ConsoleLoading,
  pendingMs: 0,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("users")
      .select("active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && profile.active === false) {
      // Backstop for accounts deactivated mid-session; sign-in itself also checks.
      noteAuthReason("deactivated");
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { deactivated: true } });
    }
    // Gym-level kill switch, set by the platform console. Platform admins have
    // no gym (gym_id IS NULL) and my_gym_enabled() returns true for them.
    const { data: gymEnabled } = await supabase.rpc("my_gym_enabled");
    if (gymEnabled === false) {
      noteAuthReason("gymDisabled");
      const info = await checkGymPaused();
      if (info) {
        try {
          sessionStorage.setItem("fitfoundry:gym-paused", JSON.stringify(info));
        } catch {
          /* ignore */
        }
      }
      await supabase.auth.signOut();
      throw redirect({
        to: "/auth",
        search: { reason: "gym_disabled", gym: info?.gymSlug ?? undefined },
      });
    }
    return { user: data.user };
  },
  component: SignedInShell,
});

function SignedInShell() {
  useEffect(() => {
    void registerSW();
  }, []);
  return (
    <>
      <GymBrandHead />
      <Outlet />
    </>
  );
}

/** Swap manifest, theme-color and apple-touch-icon to the signed-in user's gym. */
function GymBrandHead() {
  const fetchTheme = useServerFn(getGymTheme);
  const { data: theme } = useQuery({
    queryKey: ["gym-theme"],
    queryFn: () => fetchTheme(),
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    const slug = (theme as any)?.slug as string | null | undefined;
    if (!theme || !slug) return;
    const restore: (() => void)[] = [];
    const setAttr = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLElement>(selector);
      const created = !el;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      const prev = el.getAttribute(attr);
      el.setAttribute(attr, value);
      restore.push(() => (created ? el!.remove() : prev != null && el!.setAttribute(attr, prev)));
    };
    setAttr(
      'link[rel="manifest"]',
      () => Object.assign(document.createElement("link"), { rel: "manifest" }),
      "href",
      `/manifest/${encodeURIComponent(slug)}.webmanifest`,
    );
    setAttr(
      'meta[name="theme-color"]',
      () => Object.assign(document.createElement("meta"), { name: "theme-color" }),
      "content",
      theme.primaryColor,
    );
    if (theme.logoUrl)
      setAttr(
        'link[rel="apple-touch-icon"]',
        () => Object.assign(document.createElement("link"), { rel: "apple-touch-icon" }),
        "href",
        theme.logoUrl,
      );
    return () => restore.reverse().forEach((f) => f());
  }, [theme]);
  return null;
}
