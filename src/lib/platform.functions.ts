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

export type PaymentStatus = "trialing" | "paid" | "pending" | "overdue" | "failed" | "cancelled";

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

/* ============================ gym provisioning ============================ */

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Gym code must be at least 3 characters")
  .max(32, "Gym code must be at most 32 characters")
  .regex(/^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$/, "Use lowercase letters, numbers and hyphens");

const createGymSchema = z.object({
  name: z.string().trim().min(1, "Gym name is required").max(80),
  slug: slugSchema,
  timezone: z.string().trim().min(1),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code"),
  ownerEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  subscriptionPlan: z.enum(["starter", "growth", "pro", "chain"]),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb colour")
    .optional()
    .or(z.literal("")),
  supportEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  supportPhone: z.string().trim().max(32).optional().or(z.literal("")),
  internalNote: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const checkGymSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ context, data: input }): Promise<{ available: boolean }> => {
    const { data, error } = await context.supabase.rpc("platform_slug_available", {
      _slug: input.slug.trim().toLowerCase(),
    });
    if (error) fail(error);
    return { available: data === true };
  });

/**
 * Invite the owner of a gym. This is the one place the service role is
 * genuinely required: creating an auth user and sending the invite email is
 * only possible through the Auth Admin API.
 *
 * The authorisation gate is still the user-scoped `platform_gym_detail` RPC —
 * if the caller is not a platform admin, it raises 42501 before we ever reach
 * the admin client.
 */
async function inviteOwner(
  supabase: { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }> },
  gymId: string,
  email: string,
  allowExisting: boolean,
): Promise<{ ok: true }> {
  const { data: detail, error: dErr } = await supabase.rpc("platform_gym_detail", {
    _gym_id: gymId,
  });
  if (dErr) fail(dErr);
  const gym = detail as { slug?: string } | null;
  if (!gym?.slug) throw new Error("Gym not found");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id, gym_id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser && !allowExisting && existingUser.gym_id !== gymId) {
    throw new Error("That email already has a FitForge account");
  }

  const localPart = email.split("@")[0] ?? email;
  const { data: invited, error: iErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { gym_slug: gym.slug, display_name: localPart },
  });

  if (iErr) {
    const already = /already/i.test(iErr.message ?? "");
    if (!(already && allowExisting)) {
      throw new Error(iErr.message || "Could not send the invite email");
    }
  }

  const userId = invited?.user?.id ?? existingUser?.id ?? null;

  if (userId) {
    // An owner is staff, not a member: drop the member profile the signup
    // trigger created and replace the hardcoded 'member' role with 'admin'.
    await supabaseAdmin.from("member_profiles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, gym_id: gymId, role: "admin" });
    if (rErr && !/duplicate key/i.test(rErr.message)) throw new Error(rErr.message);
    await supabaseAdmin.from("users").update({ gym_id: gymId }).eq("id", userId);
  }

  const { error: mErr } = await supabase.rpc("platform_mark_owner_invited", {
    _gym_id: gymId,
    _email: email,
  });
  if (mErr) fail(mErr);

  return { ok: true };
}

const inviteSchema = z.object({
  gymId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
});

export const inviteGymOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gymId: string; email: string }) => inviteSchema.parse(input))
  .handler(async ({ context, data: input }): Promise<{ ok: true }> => {
    return inviteOwner(context.supabase as never, input.gymId, input.email, false);
  });

export const resendGymOwnerInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gymId: string; email: string }) => inviteSchema.parse(input))
  .handler(async ({ context, data: input }): Promise<{ ok: true }> => {
    return inviteOwner(context.supabase as never, input.gymId, input.email, true);
  });

export const createGym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createGymSchema.parse(input))
  .handler(
    async ({
      context,
      data: input,
    }): Promise<{ gymId: string; ownerInvited: boolean; inviteError: string | null }> => {
      const { data, error } = await context.supabase.rpc("platform_create_gym", {
        _name: input.name,
        _slug: input.slug,
        _timezone: input.timezone,
        _currency: input.currency,
        _owner_email: input.ownerEmail || undefined,
        _subscription_plan: input.subscriptionPlan,
        _primary_color: input.primaryColor || undefined,
        _support_email: input.supportEmail || undefined,
        _support_phone: input.supportPhone || undefined,
        _internal_note: input.internalNote || undefined,
      });
      if (error) fail(error);
      const gymId = data as unknown as string;

      if (!input.ownerEmail) return { gymId, ownerInvited: false, inviteError: null };

      // The gym exists now. If the invite fails we deliberately keep it and
      // report the reason — a half-created gym the console can fix beats a
      // silent orphan or a rollback that loses the operator's input.
      try {
        await inviteOwner(context.supabase as never, gymId, input.ownerEmail, false);
        return { gymId, ownerInvited: true, inviteError: null };
      } catch (e) {
        return {
          gymId,
          ownerInvited: false,
          inviteError: (e as Error).message || "Could not send the invite email",
        };
      }
    },
  );

