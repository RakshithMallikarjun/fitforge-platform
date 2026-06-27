import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  activeMembers: number;
  newThisMonth: number;
  sessionsToday: number;
  avgCheckIns7d: number;
};

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("users")
      .select("gym_id")
      .eq("id", userId)
      .maybeSingle();
    const gymId = (me as any)?.gym_id as string | null;
    if (!gymId) {
      return { activeMembers: 0, newThisMonth: 0, sessionsToday: 0, avgCheckIns7d: 0 };
    }

    const { data: memberRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("gym_id", gymId)
      .eq("role", "member");
    const memberIds = (memberRoles ?? []).map((r: any) => r.user_id as string);

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400_000).toISOString();

    let activeMembers = 0;
    let newThisMonth = 0;
    if (memberIds.length) {
      const [{ count: ac }, { count: nm }] = await Promise.all([
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .in("id", memberIds)
          .eq("active", true),
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .in("id", memberIds)
          .gte("created_at", monthStart),
      ]);
      activeMembers = ac ?? 0;
      newThisMonth = nm ?? 0;
    }

    const [{ count: sessions }, { count: weekCheckIns }] = await Promise.all([
      supabase
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", gymId)
        .eq("date", todayStr),
      supabase
        .from("attendance_logs")
        .select("id", { count: "exact", head: true })
        .eq("gym_id", gymId)
        .gte("check_in_at", sevenDaysAgo),
    ]);

    return {
      activeMembers,
      newThisMonth,
      sessionsToday: sessions ?? 0,
      avgCheckIns7d: Math.round(((weekCheckIns ?? 0) / 7) * 10) / 10,
    };
  });
