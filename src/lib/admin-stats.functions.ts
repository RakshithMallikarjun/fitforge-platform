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

// ---------- Trainer performance ----------
export type TrainerStat = {
  trainerId: string;
  displayName: string | null;
  email: string;
  assignedMembers: number;
  plansThisMonth: number;
  assessmentsThisMonth: number;
};

export const getTrainerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerStat[]> => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("users").select("gym_id").eq("id", userId).maybeSingle();
    const gymId = (me as any)?.gym_id as string | null;
    if (!gymId) return [];

    const { data: trainerRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("gym_id", gymId)
      .in("role", ["trainer", "admin"]);
    const trainerIds = Array.from(new Set((trainerRoles ?? []).map((r: any) => r.user_id as string)));
    if (!trainerIds.length) return [];

    const { data: trainers } = await supabase
      .from("users")
      .select("id, display_name, email")
      .in("id", trainerIds);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [{ data: assigns }, { data: plans }, { data: assess }] = await Promise.all([
      supabase.from("trainer_assignments").select("trainer_id").eq("gym_id", gymId).eq("active", true),
      supabase.from("workout_plans").select("trainer_id").eq("gym_id", gymId).gte("created_at", monthStart).eq("is_template", false),
      supabase.from("fitness_assessments").select("trainer_id").eq("gym_id", gymId).gte("created_at", monthStart),
    ]);

    const bump = (m: Map<string, number>, k: string | null) => { if (k) m.set(k, (m.get(k) ?? 0) + 1); };
    const aMap = new Map<string, number>(); (assigns ?? []).forEach((r: any) => bump(aMap, r.trainer_id));
    const pMap = new Map<string, number>(); (plans ?? []).forEach((r: any) => bump(pMap, r.trainer_id));
    const asMap = new Map<string, number>(); (assess ?? []).forEach((r: any) => bump(asMap, r.trainer_id));

    return (trainers ?? []).map((t: any) => ({
      trainerId: t.id,
      displayName: t.display_name,
      email: t.email,
      assignedMembers: aMap.get(t.id) ?? 0,
      plansThisMonth: pMap.get(t.id) ?? 0,
      assessmentsThisMonth: asMap.get(t.id) ?? 0,
    }));
  });

// ---------- Attendance report ----------
export type AttendanceReport = {
  totalCheckIns: number;
  uniqueMembers: number;
  avgPerDay: number;
  daily: { date: string; count: number; rolling7: number }[];
  peakHours: { hour: number; count: number }[];
};

export const getAttendanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { startDate: string; endDate: string }) => d)
  .handler(async ({ data, context }): Promise<AttendanceReport> => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("users").select("gym_id").eq("id", userId).maybeSingle();
    const gymId = (me as any)?.gym_id as string | null;
    const empty: AttendanceReport = { totalCheckIns: 0, uniqueMembers: 0, avgPerDay: 0, daily: [], peakHours: [] };
    if (!gymId) return empty;

    const startIso = new Date(data.startDate + "T00:00:00").toISOString();
    const endIso = new Date(data.endDate + "T23:59:59").toISOString();
    const { data: logs } = await supabase
      .from("attendance_logs")
      .select("member_id, check_in_at")
      .eq("gym_id", gymId)
      .gte("check_in_at", startIso)
      .lte("check_in_at", endIso)
      .limit(10000);

    const dayMap = new Map<string, number>();
    const hourMap = new Map<number, number>();
    const memberSet = new Set<string>();
    for (const l of logs ?? []) {
      const dt = new Date(l.check_in_at);
      const day = dt.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
      hourMap.set(dt.getHours(), (hourMap.get(dt.getHours()) ?? 0) + 1);
      memberSet.add(l.member_id);
    }

    // Fill missing days
    const daily: { date: string; count: number; rolling7: number }[] = [];
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const counts: number[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const c = dayMap.get(key) ?? 0;
      counts.push(c);
      const window = counts.slice(Math.max(0, counts.length - 7));
      const roll = Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10;
      daily.push({ date: key, count: c, rolling7: roll });
    }

    const total = logs?.length ?? 0;
    const peakHours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    return {
      totalCheckIns: total,
      uniqueMembers: memberSet.size,
      avgPerDay: daily.length ? Math.round((total / daily.length) * 10) / 10 : 0,
      daily,
      peakHours,
    };
  });

// ---------- Engagement report ----------
export type EngagementRow = {
  memberId: string;
  displayName: string | null;
  email: string;
  workouts30d: number;
  checkIns30d: number;
  messages30d: number;
  score: number;
  lastWorkout: string | null;
  lastCheckIn: string | null;
  trainer: string | null;
};

export const getEngagementReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EngagementRow[]> => {
    const { supabase, userId } = context;
    try {
      const { data: me } = await supabase.from("users").select("gym_id").eq("id", userId).maybeSingle();
      const gymId = (me as any)?.gym_id as string | null;
      if (!gymId) return [];

      const { data: myRoles } = await supabase
        .from("user_roles").select("role").eq("user_id", userId);
      const roles = (myRoles ?? []).map((r: any) => r.role as string);
      const isAdmin = roles.includes("admin");
      const isTrainer = roles.includes("trainer");

      const { data: memberRoles } = await supabase
        .from("user_roles").select("user_id").eq("gym_id", gymId).eq("role", "member");
      let memberIds = (memberRoles ?? []).map((r: any) => r.user_id as string);

      if (!isAdmin && isTrainer) {
        const { data: myAssigned } = await supabase
          .from("trainer_assignments")
          .select("member_id")
          .eq("gym_id", gymId)
          .eq("trainer_id", userId)
          .eq("active", true);
        const assignedSet = new Set((myAssigned ?? []).map((a: any) => a.member_id as string));
        memberIds = memberIds.filter((id) => assignedSet.has(id));
      }
      if (!memberIds.length) return [];


    const { data: members } = await supabase
      .from("users").select("id, display_name, email").in("id", memberIds);

    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const [{ data: workouts }, { data: attend }, { data: msgs }, { data: assigns }] = await Promise.all([
      supabase.from("workout_logs").select("member_id, completed_at, date")
        .eq("gym_id", gymId).in("member_id", memberIds).gte("date", since.slice(0, 10)),
      supabase.from("attendance_logs").select("member_id, check_in_at")
        .eq("gym_id", gymId).in("member_id", memberIds).gte("check_in_at", since),
      supabase.from("messages").select("sender_id, recipient_id, created_at")
        .eq("gym_id", gymId).gte("created_at", since),
      supabase.from("trainer_assignments").select("member_id, trainer_id")
        .eq("gym_id", gymId).eq("active", true).in("member_id", memberIds),
    ]);

    const trainerIds = Array.from(new Set((assigns ?? []).map((a: any) => a.trainer_id).filter(Boolean)));
    const { data: trainers } = trainerIds.length
      ? await supabase.from("users").select("id, display_name, email").in("id", trainerIds)
      : { data: [] as any[] };
    const tMap = new Map((trainers ?? []).map((t: any) => [t.id, t.display_name ?? t.email]));
    const trainerByMember = new Map<string, string>();
    (assigns ?? []).forEach((a: any) => {
      if (!trainerByMember.has(a.member_id)) trainerByMember.set(a.member_id, tMap.get(a.trainer_id) ?? "");
    });

    const wCount = new Map<string, number>();
    const wLast = new Map<string, string>();
    for (const w of workouts ?? []) {
      wCount.set(w.member_id, (wCount.get(w.member_id) ?? 0) + 1);
      const cur = wLast.get(w.member_id);
      const d = w.completed_at ?? w.date;
      if (d && (!cur || d > cur)) wLast.set(w.member_id, d);
    }
    const cCount = new Map<string, number>();
    const cLast = new Map<string, string>();
    for (const a of attend ?? []) {
      cCount.set(a.member_id, (cCount.get(a.member_id) ?? 0) + 1);
      const cur = cLast.get(a.member_id);
      if (!cur || a.check_in_at > cur) cLast.set(a.member_id, a.check_in_at);
    }
    const mCount = new Map<string, number>();
    for (const m of msgs ?? []) {
      if (memberIds.includes(m.sender_id)) mCount.set(m.sender_id, (mCount.get(m.sender_id) ?? 0) + 1);
      if (memberIds.includes(m.recipient_id)) mCount.set(m.recipient_id, (mCount.get(m.recipient_id) ?? 0) + 1);
    }

    const raw = (members ?? []).map((u: any) => {
      const w = wCount.get(u.id) ?? 0;
      const c = cCount.get(u.id) ?? 0;
      const m = mCount.get(u.id) ?? 0;
      return {
        memberId: u.id,
        displayName: u.display_name,
        email: u.email,
        workouts30d: w,
        checkIns30d: c,
        messages30d: m,
        rawScore: w * 3 + c * 2 + m * 1,
        lastWorkout: wLast.get(u.id) ?? null,
        lastCheckIn: cLast.get(u.id) ?? null,
        trainer: trainerByMember.get(u.id) ?? null,
      };
    });
    const max = Math.max(1, ...raw.map((r) => r.rawScore));
    return raw.map((r) => ({
      memberId: r.memberId,
      displayName: r.displayName,
      email: r.email,
      workouts30d: r.workouts30d,
      checkIns30d: r.checkIns30d,
      messages30d: r.messages30d,
      score: Math.round((r.rawScore / max) * 100),
      lastWorkout: r.lastWorkout,
      lastCheckIn: r.lastCheckIn,
      trainer: r.trainer,
    }));
    } catch (err) {
      console.error("getEngagementReport failed:", err);
      throw err;
    }
  });

