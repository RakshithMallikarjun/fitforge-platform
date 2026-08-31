import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
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
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { deactivated: true } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
