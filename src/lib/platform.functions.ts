import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Platform (site-owner) console data access.
 *
 * Every call goes through the USER-scoped Supabase client — never the admin
 * client. The gate is each RPC's own `is_platform_admin()` check, so a gym
 * admin calling these endpoints directly gets a Postgres 42501 error which we
 * surface as "Forbidden".
 */

function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "Request failed";
  if (error?.code === "42501" || /forbidden/i.test(msg)) throw new Error("Forbidden");
  throw new Error(msg);
}

export type PlatformOverview = {
  total_gyms: number;
  enabled_gyms: number;
  disabled_gyms: number;
  gyms_by_payment_status: Record<string, number>;
  gyms_by_plan: Record<string, number>;
  total_members: number;
  active_members: number;
  total_trainers: number;
  total_admins: number;
  new_gyms_30d: number;
  new_members_30d: number;
  workouts_30d: number;
  checkins_30d: number;
  plans_30d: number;
  assessments_30d: number;
  dau: number;
  wau: number;
  mau: number;
  stickiness: number | null;
  engaged_gyms_30d: number;
  at_risk_gyms: number;
  overdue_gyms: number;
};

export type PaymentStatus =
  | "trialing"
  | "paid"
  | "pending"
  | "overdue"
  | "failed"
  | "cancelled";

export type SubscriptionPlan = "starter" | "growth" | "pro" | "chain";

export type PlatformGymRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  timezone: string;
  custom_domain: string | null;
  subscription_plan: SubscriptionPlan;
  is_enabled: boolean;
  disabled_at: string | null;
  payment_status: PaymentStatus;
  last_payment_at: string | null;
  next_due_at: string | null;
  monthly_amount: number | null;
  currency: string;
  member_count: number;
  active_member_count: number;
  trainer_count: number;
  admin_count: number;
  workouts_7d: number;
  workouts_30d: number;
  checkins_7d: number;
  checkins_30d: number;
  plans_30d: number;
  assessments_30d: number;
  active_member_ratio: number | null;
  workouts_per_active_member_30d: number | null;
  checkin_rate_30d: number | null;
  plan_coverage: number | null;
  assessed_90d_ratio: number | null;
  members_per_trainer: number | null;
  last_activity_at: string | null;
  days_since_activity: number | null;
  health_score: number;
};

export type PlatformStaff = {
  user_id: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  role: "admin" | "trainer";
  active: boolean;
  last_sign_in_at: string | null;
};

export type PlatformGymDetail = PlatformGymRow & {
  billing_email: string | null;
  support_email: string | null;
  support_phone: string | null;
  internal_note: string | null;
  disabled_reason: string | null;
  staff: PlatformStaff[];
};

export type PlatformGymAdminRow = {
  gym_id: string;
  gym_name: string;
  gym_slug: string;
  is_enabled: boolean;
  user_id: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  role: "admin" | "trainer";
  active: boolean;
  last_sign_in_at: string | null;
};

export type SignupTrendPoint = { day: string; gyms_created: number; members_created: number };
export type ActivityTrendPoint = {
  day: string;
  workouts: number;
  checkins: number;
  active_members: number;
};
export type GymActivityPoint = { day: string; workouts: number; checkins: number };

export type FeatureAdoption = {
  enabled_gyms: number;
  plans: number | null;
  assessments: number | null;
  checkins: number | null;
  qr_checkins: number | null;
  messaging: number | null;
  ai_overload: number | null;
  progress_photos: number | null;
};

export type RetentionCohort = {
  cohort_month: string;
  cohort_size: number;
  active_m1: number;
  active_m2: number;
  active_m3: number;
};

export type AuditEntry = {
  id: number;
  actor_id: string;
  actor_email: string | null;
  action: string;
  gym_id: string | null;
  gym_name: string | null;
  detail: Record<string, string | number | boolean | null> | null;
  created_at: string;
};

export const isPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data, error } = await context.supabase.rpc("is_platform_admin");
    if (error) return false;
    return data === true;
  });

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformOverview> => {
    const { data, error } = await context.supabase.rpc("platform_overview");
    if (error) fail(error);
    return data as unknown as PlatformOverview;
  });

export const listPlatformGyms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformGymRow[]> => {
    const { data, error } = await context.supabase.rpc("platform_gyms");
    if (error) fail(error);
    return (data ?? []) as unknown as PlatformGymRow[];
  });

export const getPlatformGymDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gymId: string }) => input)
  .handler(async ({ context, data: input }): Promise<PlatformGymDetail | null> => {
    const { data, error } = await context.supabase.rpc("platform_gym_detail", {
      _gym_id: input.gymId,
    });
    if (error) fail(error);
    return (data as unknown as PlatformGymDetail) ?? null;
  });

export const listPlatformGymAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformGymAdminRow[]> => {
    const { data, error } = await context.supabase.rpc("platform_gym_admins");
    if (error) fail(error);
    return (data ?? []) as unknown as PlatformGymAdminRow[];
  });

export const getPlatformSignupTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => input ?? {})
  .handler(async ({ context, data: input }): Promise<SignupTrendPoint[]> => {
    const { data, error } = await context.supabase.rpc("platform_signup_trend", {
      _days: input.days ?? 90,
    });
    if (error) fail(error);
    return (data ?? []) as unknown as SignupTrendPoint[];
  });

export const getPlatformActivityTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => input ?? {})
  .handler(async ({ context, data: input }): Promise<ActivityTrendPoint[]> => {
    const { data, error } = await context.supabase.rpc("platform_activity_trend", {
      _days: input.days ?? 30,
    });
    if (error) fail(error);
    return (data ?? []) as unknown as ActivityTrendPoint[];
  });

export const getPlatformGymActivityTrend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gymId: string; days?: number }) => input)
  .handler(async ({ context, data: input }): Promise<GymActivityPoint[]> => {
    const { data, error } = await context.supabase.rpc("platform_gym_activity_trend", {
      _gym_id: input.gymId,
      _days: input.days ?? 30,
    });
    if (error) fail(error);
    return (data ?? []) as unknown as GymActivityPoint[];
  });

export const getFeatureAdoption = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeatureAdoption> => {
    const { data, error } = await context.supabase.rpc("platform_feature_adoption");
    if (error) fail(error);
    return data as unknown as FeatureAdoption;
  });

export const getRetentionCohorts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { months?: number } | undefined) => input ?? {})
  .handler(async ({ context, data: input }): Promise<RetentionCohort[]> => {
    const { data, error } = await context.supabase.rpc("platform_retention_cohorts", {
      _months: input.months ?? 6,
    });
    if (error) fail(error);
    return (data ?? []) as unknown as RetentionCohort[];
  });

export const getAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gymId?: string | null; limit?: number } | undefined) => input ?? {})
  .handler(async ({ context, data: input }): Promise<AuditEntry[]> => {
    const { data, error } = await context.supabase.rpc("platform_audit_recent", {
      _gym_id: input.gymId ?? undefined,
      _limit: input.limit ?? 50,
    });
    if (error) fail(error);
    return (data ?? []) as unknown as AuditEntry[];
  });

export const setGymEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gymId: string; enabled: boolean; reason?: string | null }) => {
    if (!input.enabled && !input.reason?.trim()) {
      throw new Error("A reason is required when disabling a gym");
    }
    return input;
  })
  .handler(async ({ context, data: input }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("platform_set_gym_enabled", {
      _gym_id: input.gymId,
      _enabled: input.enabled,
      _reason: input.reason?.trim() || undefined,
    });
    if (error) fail(error);
    return { ok: true };
  });

export const setPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      gymId: string;
      status: PaymentStatus;
      lastPaymentAt?: string | null;
      nextDueAt?: string | null;
      monthlyAmount?: number | null;
      currency?: string | null;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ context, data: input }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("platform_set_payment_status", {
      _gym_id: input.gymId,
      _status: input.status,
      _last_payment_at: input.lastPaymentAt || undefined,
      _next_due_at: input.nextDueAt || undefined,
      _monthly_amount: input.monthlyAmount ?? undefined,
      _currency: input.currency || undefined,
      _note: input.note?.trim() || undefined,
    });
    if (error) fail(error);
    return { ok: true };
  });

export const setGymPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gymId: string; plan: SubscriptionPlan }) => input)
  .handler(async ({ context, data: input }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("platform_set_gym_plan", {
      _gym_id: input.gymId,
      _plan: input.plan,
    });
    if (error) fail(error);
    return { ok: true };
  });
