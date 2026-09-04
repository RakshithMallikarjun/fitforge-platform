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
      noteAuthReason("deactivated");
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { deactivated: true } });
    }
    // Gym-level kill switch, set by the platform console. Platform admins have
    // no gym (gym_id IS NULL) and my_gym_enabled() returns true for them.
    const { data: gymEnabled } = await supabase.rpc("my_gym_enabled");
    if (gymEnabled === false) {
      noteAuthReason("gymDisabled");
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { gymDisabled: true } });
    }
    return { user: data.user };

  },
  component: () => <Outlet />,
});
