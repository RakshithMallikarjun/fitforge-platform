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
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { deactivated: "1" } as any });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
