import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dateStringInZone } from "@/lib/gym-date";

/**
 * Membership tiers, the payment ledger and the dues engine.
 *
 * Every read and write goes through the USER-scoped Supabase client. The gate is
 * either RLS on the table or the RPC's own staff/admin guard, so a caller from
 * another gym gets a Postgres 42501 which we surface as "Forbidden".
 */

function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "Request failed";
  if (error?.code === "42501" || /forbidden/i.test(msg)) throw new Error("Forbidden");
  throw new Error(msg);
}

export const BILLING_PERIODS = ["monthly", "quarterly", "half_yearly", "annual"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annual: "Annual",
};

export const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

const periodSchema = z.enum(BILLING_PERIODS);
const uuid = z.string().uuid();

export type PlanPrice = {
  id: string;
  plan_id: string;
  period: BillingPeriod;
  price: number;
  is_enabled: boolean;
};

export type MembershipPlan = {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  features: string[];
  badge_color: string | null;
  hides_ads: boolean;
  is_active: boolean;
  sort_order: number;
  archived_at: string | null;
  prices: PlanPrice[];
  member_count: number;
  /** The gym's own ISO currency code — never hardcode a symbol in the UI. */
  currency: string;
};

async function gymOf(supabase: any, userId: string) {
  const { data } = await supabase
    .from("users")
    .select("gym_id, gyms(currency, name, timezone)")
    .eq("id", userId)
    .maybeSingle();
  return {
    gymId: (data as any)?.gym_id as string | null,
    currency: ((data as any)?.gyms?.currency as string | null) ?? "INR",
    gymName: ((data as any)?.gyms?.name as string | null) ?? "your gym",
    timeZone: ((data as any)?.gyms?.timezone as string | null) ?? "UTC",
  };
}

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin")) throw new Error("Forbidden");
  return roles as string[];
}

// =================== tiers ===================

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MembershipPlan[]> => {
    const { supabase, userId } = context;
    const { gymId, currency } = await gymOf(supabase, userId);
    if (!gymId) return [];

    const { data: plans, error } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("gym_id", gymId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) fail(error);

    const ids = (plans ?? []).map((p: any) => p.id);
    if (!ids.length) return [];

    const [{ data: prices }, { data: subs }] = await Promise.all([
      supabase.from("membership_plan_prices").select("*").in("plan_id", ids),
      supabase
        .from("member_subscriptions")
        .select("plan_id, state")
        .eq("gym_id", gymId)
        .in("plan_id", ids),
    ]);

    return (plans ?? []).map((p: any) => ({
      ...p,
      currency,
      features: p.features ?? [],
      prices: ((prices ?? []) as any[])
        .filter((pr) => pr.plan_id === p.id)
        .map((pr) => ({ ...pr, price: Number(pr.price) })),
      member_count: ((subs ?? []) as any[]).filter(
        (s) => s.plan_id === p.id && s.state === "active",
      ).length,
    }));
  });

const planInput = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(400).nullable().optional(),
  features: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  badgeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb colour")
    .nullable()
    .optional(),
  hidesAds: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const createPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { gymId } = await gymOf(supabase, userId);
    if (!gymId) throw new Error("Forbidden");

    const { data: row, error } = await supabase
      .from("membership_plans")
      .insert({
        gym_id: gymId,
        name: data.name,
        description: data.description ?? null,
        features: data.features ?? [],
        badge_color: data.badgeColor ?? null,
        hides_ads: data.hidesAds ?? false,
        is_active: data.isActive ?? true,
        sort_order: data.sortOrder ?? 0,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505" || /duplicate key/i.test(error.message))
        throw new Error("A tier with that name already exists");
      fail(error);
    }
    return { id: (row as any).id as string };
  });

export const updatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planInput.partial().extend({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const patch = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.features !== undefined ? { features: data.features } : {}),
      ...(data.badgeColor !== undefined ? { badge_color: data.badgeColor } : {}),
      ...(data.hidesAds !== undefined ? { hides_ads: data.hidesAds } : {}),
      ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
      ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
    };

    const { error } = await supabase.from("membership_plans").update(patch).eq("id", data.id);
    if (error) fail(error);
    return { ok: true };
  });

export const archivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const { count } = await supabase
      .from("member_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", data.id)
      .eq("state", "active");
    if ((count ?? 0) > 0) {
      throw new Error(
        `${count} member${count === 1 ? "" : "s"} still hold this tier. Move them to another tier first.`,
      );
    }

    const { error } = await supabase
      .from("membership_plans")
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) fail(error);
    return { ok: true };
  });

export const reorderPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(uuid).min(1).max(50) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await supabase
        .from("membership_plans")
        .update({ sort_order: i })
        .eq("id", data.ids[i]);
      if (error) fail(error);
    }
    return { ok: true };
  });

export const setPlanPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: uuid,
        period: periodSchema,
        price: z.number().min(0).max(10_000_000),
        isEnabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { error } = await supabase.from("membership_plan_prices").upsert(
      {
        plan_id: data.planId,
        period: data.period,
        price: data.price,
        is_enabled: data.isEnabled,
      },
      { onConflict: "plan_id,period" },
    );
    if (error) fail(error);
    return { ok: true };
  });

export const removePlanPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: uuid, period: periodSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { error } = await supabase
      .from("membership_plan_prices")
      .delete()
      .eq("plan_id", data.planId)
      .eq("period", data.period);
    if (error) fail(error);
    return { ok: true };
  });

/** Bronze / Silver / Gold starter set, inactive and unpriced. */
export const seedStarterPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { gymId } = await gymOf(supabase, userId);
    if (!gymId) throw new Error("Forbidden");

    const rows = [
      { name: "Bronze", badge_color: "#b45309", sort_order: 0 },
      { name: "Silver", badge_color: "#64748b", sort_order: 1 },
      { name: "Gold", badge_color: "#d97706", sort_order: 2 },
    ].map((r) => ({
      ...r,
      gym_id: gymId,
      is_active: false,
      description: "Set your prices to start selling this tier.",
    }));

    const { error } = await supabase
      .from("membership_plans")
      .upsert(rows, { onConflict: "gym_id,name", ignoreDuplicates: true });
    if (error) fail(error);
    return { ok: true };
  });

// =================== subscriptions & payments ===================

export type MemberSubscription = {
  id: string;
  plan_id: string;
  plan_name_snapshot: string;
  period: BillingPeriod;
  started_on: string;
  ends_on: string;
  state: "active" | "expired" | "cancelled" | "superseded";
  cancelled_at: string | null;
  cancel_reason: string | null;
  superseded_by: string | null;
  badge_color?: string | null;
};

export const listMemberSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: uuid }).parse(d))
  .handler(async ({ context, data }): Promise<MemberSubscription[]> => {
    const { supabase, userId } = context;
    // Keep the derived mirrors honest whenever staff open a member record.
    await supabase.rpc("sync_member_membership", { _member_id: data.memberId });
    void userId;

    const { data: rows, error } = await supabase
      .from("member_subscriptions")
      .select(
        "id, plan_id, plan_name_snapshot, period, started_on, ends_on, state, cancelled_at, cancel_reason, superseded_by, membership_plans(badge_color)",
      )
      .eq("member_id", data.memberId)
      .order("ends_on", { ascending: false });
    if (error) fail(error);
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      badge_color: r.membership_plans?.badge_color ?? null,
    }));
  });

export type MemberPayment = {
  id: string;
  plan_name_snapshot: string;
  period_snapshot: BillingPeriod;
  amount: number;
  currency: string;
  paid_on: string;
  covers_from: string;
  covers_to: string;
  method: PaymentMethod;
  state: "recorded" | "refunded";
  reference: string | null;
  note: string | null;
  refund_of: string | null;
  recorded_by_name: string | null;
};

export const listMemberPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memberId: uuid }).parse(d))
  .handler(async ({ context, data }): Promise<MemberPayment[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("member_payments")
      .select("*")
      .eq("member_id", data.memberId)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) fail(error);

    const staffIds = Array.from(
      new Set(((rows ?? []) as any[]).map((r) => r.recorded_by).filter(Boolean)),
    );
    const { data: staff } = staffIds.length
      ? await supabase.from("users").select("id, display_name, email").in("id", staffIds)
      : { data: [] as any[] };
    const staffMap = new Map(
      ((staff ?? []) as any[]).map((s) => [s.id, s.display_name ?? s.email]),
    );

    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      amount: Number(r.amount),
      recorded_by_name: r.recorded_by ? (staffMap.get(r.recorded_by) ?? null) : null,
    }));
  });

export type PaymentPreview = {
  price: number | null;
  currency: string;
  covers_from: string;
  covers_to: string;
  previous_ends_on: string | null;
  is_renewal: boolean;
  is_lapsed_restart: boolean;
  days_lapsed: number;
  supersedes_plan_name: string | null;
};

export const previewPayment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        memberId: uuid,
        planId: uuid,
        period: periodSchema,
        startsOn: z.string().date().nullable().optional(),
        supersede: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<PaymentPreview> => {
    const { supabase } = context;
    const { data: res, error } = await supabase.rpc("preview_member_payment", {
      _member_id: data.memberId,
      _plan_id: data.planId,
      _period: data.period,
      _starts_on: data.startsOn ?? undefined,
      _supersede: data.supersede ?? true,
    });
    if (error) fail(error);
    const r = res as any;
    return { ...r, price: r?.price == null ? null : Number(r.price) };
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        memberId: uuid,
        planId: uuid,
        period: periodSchema,
        amount: z.number().min(0).max(10_000_000).nullable().optional(),
        paidOn: z.string().date().nullable().optional(),
        method: z.enum(PAYMENT_METHODS).optional(),
        reference: z.string().trim().max(60).nullable().optional(),
        note: z.string().trim().max(500).nullable().optional(),
        startsOn: z.string().date().nullable().optional(),
        supersede: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // The recorded amount is derived from the gym's configured plan price, so a
    // caller cannot grant a membership period for an amount of their choosing.
    const { data: priceRow, error: priceErr } = await supabase
      .from("membership_plan_prices")
      .select("price, is_enabled")
      .eq("plan_id", data.planId)
      .eq("period", data.period)
      .maybeSingle();
    if (priceErr) fail(priceErr);
    const configuredPrice =
      priceRow && (priceRow as any).is_enabled ? Number((priceRow as any).price) : null;
    if (configuredPrice == null) {
      throw new Error("That plan has no price set for this term. Set the price first.");
    }
    if (data.amount != null && Number(data.amount) !== configuredPrice) {
      throw new Error(`The amount must match the plan price (${configuredPrice}).`);
    }
    const { data: res, error } = await supabase.rpc("record_member_payment", {
      _member_id: data.memberId,
      _plan_id: data.planId,
      _period: data.period,
      _amount: configuredPrice,
      _paid_on: data.paidOn ?? undefined,
      _method: data.method ?? "cash",
      _reference: data.reference ?? undefined,
      _note: data.note ?? undefined,
      _starts_on: data.startsOn ?? undefined,
      _supersede: data.supersede ?? true,
    });
    if (error) fail(error);
    return res as {
      payment_id: string;
      subscription_id: string;
      covers_from: string;
      covers_to: string;
      previous_ends_on: string | null;
    };
  });

export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ paymentId: uuid, note: z.string().trim().max(500).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: res, error } = await supabase.rpc("refund_member_payment", {
      _payment_id: data.paymentId,
      _note: data.note ?? "",
    });
    if (error) fail(error);
    return res as { refund_id: string; suggest_adjust_end_date: boolean };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ subscriptionId: uuid, reason: z.string().trim().max(300).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("cancel_member_subscription", {
      _subscription_id: data.subscriptionId,
      _reason: data.reason ?? "",
    });
    if (error) fail(error);
    return { ok: true };
  });

// =================== dues ===================

export type DuesRow = {
  member_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  period: BillingPeriod;
  amount_due: number;
  currency: string;
  ends_on: string;
  days_to_due: number;
  bucket: "overdue" | "due_today" | "due_soon" | "current";
  in_grace: boolean;
  last_payment_on: string | null;
  last_reminded_at: string | null;
  reminder_count: number;
};

export const getDues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ bucket: z.enum(["all", "overdue", "due_today", "due_soon", "current"]) })
      .parse(d ?? { bucket: "all" }),
  )
  .handler(async ({ context, data }): Promise<DuesRow[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("gym_dues", { _bucket: data.bucket });
    if (error) fail(error);
    return ((rows ?? []) as any[]).map((r) => ({ ...r, amount_due: Number(r.amount_due) }));
  });

export type DuesSummary = {
  overdue_count: number;
  overdue_amount: number;
  due_today_count: number;
  due_today_amount: number;
  due_soon_count: number;
  due_soon_amount: number;
  current_count: number;
  collected_this_month: number;
  currency: string;
};

export const getDuesSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DuesSummary> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("gym_dues_summary");
    if (error) fail(error);
    const r = (data ?? {}) as any;
    return {
      overdue_count: Number(r.overdue_count ?? 0),
      overdue_amount: Number(r.overdue_amount ?? 0),
      due_today_count: Number(r.due_today_count ?? 0),
      due_today_amount: Number(r.due_today_amount ?? 0),
      due_soon_count: Number(r.due_soon_count ?? 0),
      due_soon_amount: Number(r.due_soon_amount ?? 0),
      current_count: Number(r.current_count ?? 0),
      collected_this_month: Number(r.collected_this_month ?? 0),
      currency: r.currency ?? "INR",
    };
  });

// =================== billing settings ===================

export type BillingSettings = {
  reminder_lead_days: number;
  grace_days: number;
  auto_remind_members: boolean;
  admin_digest_enabled: boolean;
  daily_summary_enabled: boolean;
  daily_summary_hour: number;
  reminder_template: string;
  timezone: string;
  admins: { id: string; name: string; email: string }[];
};

export const getBillingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingSettings> => {
    const { supabase, userId } = context;
    const { gymId, timeZone } = await gymOf(supabase, userId);
    if (!gymId) throw new Error("Forbidden");
    // Billing configuration and admin contacts are for gym administrators only.
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Forbidden");

    const { data: row, error } = await supabase.rpc("gym_billing_settings_ensure");
    if (error) fail(error);

    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("gym_id", gymId)
      .eq("role", "admin");
    const ids = ((adminRoles ?? []) as any[]).map((r) => r.user_id);
    const { data: admins } = ids.length
      ? await supabase
          .from("users")
          .select("id, display_name, email, active")
          .in("id", ids)
          .eq("active", true)
      : { data: [] as any[] };

    const s = (row ?? {}) as any;
    return {
      reminder_lead_days: s.reminder_lead_days ?? 7,
      grace_days: s.grace_days ?? 5,
      auto_remind_members: !!s.auto_remind_members,
      admin_digest_enabled: s.admin_digest_enabled ?? true,
      daily_summary_enabled: s.daily_summary_enabled ?? true,
      daily_summary_hour: s.daily_summary_hour ?? 21,
      reminder_template: s.reminder_template ?? "",
      timezone: timeZone,
      admins: ((admins ?? []) as any[]).map((a) => ({
        id: a.id,
        name: a.display_name ?? a.email,
        email: a.email,
      })),
    };
  });

export const updateBillingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        reminderLeadDays: z.number().int().min(1).max(60).optional(),
        graceDays: z.number().int().min(0).max(30).optional(),
        autoRemindMembers: z.boolean().optional(),
        adminDigestEnabled: z.boolean().optional(),
        dailySummaryEnabled: z.boolean().optional(),
        dailySummaryHour: z.number().int().min(0).max(23).optional(),
        reminderTemplate: z.string().trim().min(10).max(600).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { gymId } = await gymOf(supabase, userId);
    if (!gymId) throw new Error("Forbidden");

    await supabase.rpc("gym_billing_settings_ensure");
    const patch = {
      updated_at: new Date().toISOString(),
      ...(data.reminderLeadDays !== undefined ? { reminder_lead_days: data.reminderLeadDays } : {}),
      ...(data.graceDays !== undefined ? { grace_days: data.graceDays } : {}),
      ...(data.autoRemindMembers !== undefined
        ? { auto_remind_members: data.autoRemindMembers }
        : {}),
      ...(data.adminDigestEnabled !== undefined
        ? { admin_digest_enabled: data.adminDigestEnabled }
        : {}),
      ...(data.dailySummaryEnabled !== undefined
        ? { daily_summary_enabled: data.dailySummaryEnabled }
        : {}),
      ...(data.dailySummaryHour !== undefined ? { daily_summary_hour: data.dailySummaryHour } : {}),
      ...(data.reminderTemplate !== undefined ? { reminder_template: data.reminderTemplate } : {}),
    };

    const { error } = await supabase.from("gym_billing_settings").update(patch).eq("gym_id", gymId);
    if (error) fail(error);
    return { ok: true };
  });

// =================== reminders ===================

function renderTemplate(
  template: string,
  vals: {
    member_name: string;
    gym_name: string;
    plan_name: string;
    due_date: string;
    amount: string;
  },
) {
  return template
    .replaceAll("{member_name}", vals.member_name)
    .replaceAll("{gym_name}", vals.gym_name)
    .replaceAll("{plan_name}", vals.plan_name)
    .replaceAll("{due_date}", vals.due_date)
    .replaceAll("{amount}", vals.amount);
}

async function sendOneReminder(
  supabase: any,
  staffId: string,
  gymId: string,
  gymName: string,
  currency: string,
  timeZone: string,
  template: string,
  row: DuesRow,
  force: boolean,
) {
  if (!force && row.last_reminded_at) {
    const hrs = (Date.now() - new Date(row.last_reminded_at).getTime()) / 36e5;
    if (hrs < 24) {
      return { skipped: true as const, reason: "Reminded less than 24 hours ago" };
    }
  }

  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(row.amount_due);
  const dueDate = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${row.ends_on}T12:00:00Z`));

  const body = renderTemplate(template, {
    member_name: row.display_name ?? "there",
    gym_name: gymName,
    plan_name: row.plan_name,
    due_date: dueDate,
    amount,
  });

  const { error } = await supabase.from("messages").insert({
    gym_id: gymId,
    sender_id: staffId,
    recipient_id: row.member_id,
    body,
  });
  if (error) fail(error);

  // Best effort push — a missing subscription or a push failure must not fail the reminder.
  try {
    const { notifyMemberPush } = await import("./dues-push.server");
    await notifyMemberPush(row.member_id, gymName, body);
  } catch (e) {
    console.error("dues reminder push failed", e);
  }

  await supabase.rpc("log_payment_reminder", {
    _member_id: row.member_id,
    _subscription_id: row.subscription_id,
    _channel: "message",
    _note: null,
  });
  return { skipped: false as const, body };
}

async function reminderContext(supabase: any, userId: string) {
  const { gymId, currency, gymName, timeZone } = await gymOf(supabase, userId);
  if (!gymId) throw new Error("Forbidden");
  const { data: settings } = await supabase.rpc("gym_billing_settings_ensure");
  const template =
    (settings as any)?.reminder_template ??
    "Hi {member_name}, your {plan_name} membership at {gym_name} is due on {due_date}. Amount: {amount}.";
  const { data: dues, error } = await supabase.rpc("gym_dues", { _bucket: "all" });
  if (error) fail(error);
  return {
    gymId,
    currency,
    gymName,
    timeZone,
    template,
    dues: ((dues ?? []) as any[]).map((r) => ({
      ...r,
      amount_due: Number(r.amount_due),
    })) as DuesRow[],
  };
}

export const sendMemberReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ memberId: uuid, force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ctx = await reminderContext(supabase, userId);
    const row = ctx.dues.find((r) => r.member_id === data.memberId);
    if (!row) throw new Error("That member has nothing due right now");

    const res = await sendOneReminder(
      supabase,
      userId,
      ctx.gymId,
      ctx.gymName,
      ctx.currency,
      ctx.timeZone,
      ctx.template,
      row,
      data.force ?? false,
    );
    if (res.skipped) throw new Error(`${res.reason}. Use "Remind anyway" to send another.`);
    return { sent: 1 };
  });

export const sendBulkReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ memberIds: z.array(uuid).min(1).max(200), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ctx = await reminderContext(supabase, userId);
    let sent = 0;
    let skipped = 0;
    for (const id of data.memberIds) {
      const row = ctx.dues.find((r) => r.member_id === id);
      if (!row) {
        skipped++;
        continue;
      }
      try {
        const res = await sendOneReminder(
          supabase,
          userId,
          ctx.gymId,
          ctx.gymName,
          ctx.currency,
          ctx.timeZone,
          ctx.template,
          row,
          data.force ?? false,
        );
        if (res.skipped) skipped++;
        else sent++;
      } catch {
        skipped++;
      }
    }
    return { sent, skipped };
  });

// =================== reports ===================

export type RevenueReport = {
  currency: string;
  total_collected: number;
  monthly: { month: string; total: number }[];
  by_tier: { plan_name: string; total: number; payment_count: number }[];
  by_term: { period: BillingPeriod; total: number; payment_count: number }[];
  active_by_tier: { plan_name: string; active_count: number }[];
  expiring_30d: {
    member_id: string;
    member_name: string | null;
    plan_name: string;
    period: BillingPeriod;
    ends_on: string;
    expected_amount: number;
  }[];
  expiring_30d_value: number;
};

export const getRevenueReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ from: z.string().date(), to: z.string().date() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<RevenueReport> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { data: res, error } = await supabase.rpc("gym_revenue_report", {
      _from: data.from,
      _to: data.to,
    });
    if (error) fail(error);
    const r = (res ?? {}) as any;
    return {
      currency: r.currency ?? "INR",
      total_collected: Number(r.total_collected ?? 0),
      monthly: (r.monthly ?? []).map((m: any) => ({ ...m, total: Number(m.total) })),
      by_tier: (r.by_tier ?? []).map((m: any) => ({ ...m, total: Number(m.total) })),
      by_term: (r.by_term ?? []).map((m: any) => ({ ...m, total: Number(m.total) })),
      active_by_tier: r.active_by_tier ?? [],
      expiring_30d: (r.expiring_30d ?? []).map((m: any) => ({
        ...m,
        expected_amount: Number(m.expected_amount),
      })),
      expiring_30d_value: Number(r.expiring_30d_value ?? 0),
    };
  });

export type DailyActivityEntry = {
  member_id?: string;
  member_name: string | null;
  plan_name?: string;
  period?: BillingPeriod;
  amount: number;
  covers_from?: string;
  covers_to?: string;
  paid_on?: string;
  previous_ends_on?: string;
  note?: string | null;
  recorded_by_name: string | null;
};

export type DailyActivity = {
  gym_name: string;
  gym_timezone: string;
  currency: string;
  day: string;
  total_collected: number;
  new_count: number;
  renewal_count: number;
  refund_count: number;
  new: DailyActivityEntry[];
  renewals: DailyActivityEntry[];
  refunds: DailyActivityEntry[];
  by_staff: { recorded_by_name: string | null; payment_count: number; total: number }[];
  by_tier: { plan_name: string; payment_count: number; total: number }[];
  by_term: { period: BillingPeriod; payment_count: number; total: number }[];
};

export const getDailyActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ day: z.string().date().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { gymId, timeZone } = await gymOf(supabase, userId);
    if (!gymId) throw new Error("Forbidden");
    const day = data.day ?? dateStringInZone(timeZone);
    const { data: res, error } = await supabase.rpc("gym_daily_activity", {
      _gym_id: gymId,
      _day: day,
    });
    if (error) fail(error);
    return res as unknown as DailyActivity;
  });

/** Emails today's summary to the acting admin only; writes no daily_summary_log row. */
export const sendDailySummaryNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { gymId } = await gymOf(supabase, userId);
    if (!gymId) throw new Error("Forbidden");

    if (!process.env["RESEND_API_KEY"] || !process.env["SUMMARY_FROM_EMAIL"]) {
      throw new Error(
        "Email is not configured yet — add RESEND_API_KEY and SUMMARY_FROM_EMAIL, then try again.",
      );
    }

    const { data: me } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const email = (me as any)?.email as string | undefined;
    if (!email) throw new Error("Your account has no email address on file");

    const { runDailySummary } = await import("./daily-summary.server");
    const [res] = await runDailySummary({
      gymId,
      test: true,
      onlyEmail: email,
      force: true,
    });
    if (!res || res.outcome !== "sent") {
      throw new Error(
        `Summary email did not send${res?.errors?.length ? `: ${res.errors[0]}` : ""}`,
      );
    }
    return { ok: true, sentTo: email };
  });

// =================== member-facing ===================

export type MyMembership = {
  plan_name: string | null;
  badge_color: string | null;
  features: string[];
  period: BillingPeriod | null;
  ends_on: string | null;
  state: string | null;
  payments: {
    id: string;
    paid_on: string;
    amount: number;
    currency: string;
    plan_name_snapshot: string;
    period_snapshot: BillingPeriod;
    covers_from: string;
    covers_to: string;
    method: PaymentMethod;
  }[];
  currency: string;
  today: string;
};

export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyMembership> => {
    const { supabase, userId } = context;
    const { currency, timeZone } = await gymOf(supabase, userId);

    const [{ data: subs }, { data: payments }] = await Promise.all([
      supabase
        .from("member_subscriptions")
        .select(
          "plan_id, plan_name_snapshot, period, ends_on, state, membership_plans(badge_color, features)",
        )
        .eq("member_id", userId)
        .order("ends_on", { ascending: false }),
      supabase
        .from("member_payments")
        .select(
          "id, paid_on, amount, currency, plan_name_snapshot, period_snapshot, covers_from, covers_to, method",
        )
        .eq("member_id", userId)
        .order("paid_on", { ascending: false })
        .limit(30),
    ]);

    const active = ((subs ?? []) as any[]).find((s) => s.state === "active") ?? null;
    return {
      plan_name: active?.plan_name_snapshot ?? null,
      badge_color: active?.membership_plans?.badge_color ?? null,
      features: active?.membership_plans?.features ?? [],
      period: active?.period ?? null,
      ends_on: active?.ends_on ?? null,
      state: active?.state ?? null,
      payments: ((payments ?? []) as any[]).map((p) => ({ ...p, amount: Number(p.amount) })),
      currency,
      today: dateStringInZone(timeZone),
    };
  });
