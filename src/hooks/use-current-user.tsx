import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "trainer" | "member";

export type CurrentUser = {
  session: Session;
  userId: string;
  email: string;
  gymId: string | null;
  displayName: string | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function useCurrentUser() {
  const { session, loading } = useSession();

  const query = useQuery({
    enabled: !!session?.user?.id,
    queryKey: ["current-user", session?.user?.id],
    queryFn: async (): Promise<CurrentUser | null> => {
      if (!session?.user) return null;
      const cacheKey = `fitfoundry:current-user:${session.user.id}`;
      const readCache = () => {
        try {
          const raw = localStorage.getItem(cacheKey);
          return raw ? ({ ...JSON.parse(raw), session } as CurrentUser) : null;
        } catch {
          return null;
        }
      };
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const c = readCache();
        if (c) return c;
      }
      const [{ data: userRow, error: uErr }, { data: rolesRows, error: rErr }] = await Promise.all([
        supabase
          .from("users")
          .select("gym_id, display_name, email")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
      ]);
      // A failed request never demotes or signs anyone out: use the last known profile.
      if (uErr || rErr) {
        const c = readCache();
        if (c) return c;
      }
      const roles = (rolesRows ?? []).map((r) => r.role as AppRole);
      const primaryRole: AppRole | null = roles.includes("admin")
        ? "admin"
        : roles.includes("trainer")
          ? "trainer"
          : roles.includes("member")
            ? "member"
            : null;
      const result = {
        session,
        userId: session.user.id,
        email: userRow?.email ?? session.user.email ?? "",
        gymId: userRow?.gym_id ?? null,
        displayName: userRow?.display_name ?? null,
        roles,
        primaryRole,
      };
      try {
        const { session: _s, ...rest } = result;
        localStorage.setItem(cacheKey, JSON.stringify(rest));
      } catch {
        /* ignore */
      }
      return result;
    },
  });

  return { ...query, session, sessionLoading: loading };
}
