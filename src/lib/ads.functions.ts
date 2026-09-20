import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sponsor ads.
 *
 * Gym owners sell their own local sponsorships; the platform may backfill unsold
 * slots when (and only when) a gym opts in. Members are served through the
 * `ad_serve` RPC so draft/paused creatives are never reachable, and nothing that
 * identifies a member is ever written — counters are daily per (ad, gym).
 */

const BUCKET = "ad-creatives";
const SIGNED_URL_TTL = 60 * 60;

function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "Request failed";
  if (error?.code === "42501" || /forbidden/i.test(msg)) throw new Error("Forbidden");
  throw new Error(msg);
}

export type AdPlacement = "home_feed" | "workout_complete" | "checkin_success";
export type AdStatus = "draft" | "active" | "paused" | "archived";

export type AdRow = {
  id: string;
  gym_id: string | null;
  advertiser_name: string;
  headline: string;
  body: string | null;
  image_path: string | null;
  cta_label: string | null;
  cta_url: string | null;
  placement: AdPlacement;
  status: AdStatus;
  starts_on: string;
  ends_on: string | null;
  priority: number;
  created_at: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
};

export type GymAdSettings = {
  gym_id: string;
  ads_enabled: boolean;
  allow_platform_fill: boolean;
  max_per_member_day: number;
  revenue_note: string | null;
};

export type ServedAd = {
  id: string;
  advertiserName: string;
  headline: string;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isPlatform: boolean;
};

const placementSchema = z.enum(["home_feed", "workout_complete", "checkin_success"]);
const statusSchema = z.enum(["draft", "active", "paused", "archived"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

const adInputSchema = z.object({
  advertiserName: z.string().trim().min(1, "Advertiser name is required").max(80),
  headline: z.string().trim().min(1, "Headline is required").max(60),
  body: z.string().trim().max(160).nullish(),
  imagePath: z.string().trim().max(400).nullish(),
  ctaLabel: z.string().trim().max(24).nullish(),
  ctaUrl: z
    .string()
    .trim()
    .regex(/^https:\/\/\S+$/i, "Links must start with https://")
    .nullish(),
  placement: placementSchema,
  status: statusSchema.default("draft"),
  startsOn: dateSchema,
  endsOn: dateSchema.nullish(),
  priority: z.number().int().min(0).max(100).default(0),
});

type AdInput = z.infer<typeof adInputSchema>;

function adRecord(data: AdInput, gymId: string | null, createdBy: string) {
  if (data.endsOn && data.endsOn < data.startsOn) {
    throw new Error("The end date cannot be before the start date");
  }
  return {
    gym_id: gymId,
    advertiser_name: data.advertiserName,
    headline: data.headline,
    body: data.body?.trim() || null,
    image_path: data.imagePath?.trim() || null,
    cta_label: data.ctaLabel?.trim() || null,
    cta_url: data.ctaUrl?.trim() || null,
    placement: data.placement,
    status: data.status,
    starts_on: data.startsOn,
    ends_on: data.endsOn || null,
    priority: data.priority,
    created_by: createdBy,
  };
}

/** The signed-in user's gym, and a hard stop unless they are its admin. */
async function requireAdminGym(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("gym_id, role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) fail(error);
  const gymId = (data as { gym_id: string | null } | null)?.gym_id ?? null;
  if (!gymId) throw new Error("Forbidden");
  return gymId;
}

async function signPath(supabase: any, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

// ======================= gym admin: inventory =======================

export const listGymAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdRow[]> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);

    const [adsRes, statsRes] = await Promise.all([
      supabase.from("ads").select("*").eq("gym_id", gymId).order("created_at", { ascending: false }),
      supabase.rpc("gym_ad_report", { _days: 30 }),
    ]);
    if (adsRes.error) fail(adsRes.error);

    const stats = new Map<string, { impressions: number; clicks: number; ctr: number | null }>();
    for (const r of (statsRes.data ?? []) as any[]) {
      stats.set(r.ad_id, {
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        ctr: r.ctr === null ? null : Number(r.ctr),
      });
    }

    return ((adsRes.data ?? []) as any[]).map((a) => ({
      ...a,
      impressions: stats.get(a.id)?.impressions ?? 0,
      clicks: stats.get(a.id)?.clicks ?? 0,
      ctr: stats.get(a.id)?.ctr ?? null,
    })) as AdRow[];
  });

export const createGymAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { data: row, error } = await supabase
      .from("ads")
      .insert(adRecord(data, gymId, userId))
      .select("id")
      .single();
    if (error) fail(error);
    return { id: (row as { id: string }).id };
  });

export const updateGymAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    adInputSchema.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { id, ...rest } = data;
    const { created_by: _ignored, ...patch } = adRecord(rest as AdInput, gymId, userId);
    const { error } = await supabase.from("ads").update(patch).eq("id", id).eq("gym_id", gymId);
    if (error) fail(error);
    return { ok: true };
  });

export const setAdStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: statusSchema }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { error } = await supabase
      .from("ads")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("gym_id", gymId);
    if (error) fail(error);
    return { ok: true };
  });

export const deleteGymAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { error } = await supabase.from("ads").delete().eq("id", data.id).eq("gym_id", gymId);
    if (error) fail(error);
    return { ok: true };
  });

// ======================= gym admin: settings & reporting =======================

export const getGymAdSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GymAdSettings> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { data, error } = await supabase
      .from("gym_ad_settings")
      .select("*")
      .eq("gym_id", gymId)
      .maybeSingle();
    if (error) fail(error);
    return (
      (data as GymAdSettings | null) ?? {
        gym_id: gymId,
        ads_enabled: false,
        allow_platform_fill: false,
        max_per_member_day: 3,
        revenue_note: null,
      }
    );
  });

export const updateGymAdSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        adsEnabled: z.boolean(),
        allowPlatformFill: z.boolean(),
        maxPerMemberDay: z.number().int().min(0).max(10),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    const { error } = await supabase.from("gym_ad_settings").upsert(
      {
        gym_id: gymId,
        ads_enabled: data.adsEnabled,
        allow_platform_fill: data.allowPlatformFill,
        max_per_member_day: data.maxPerMemberDay,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gym_id" },
    );
    if (error) fail(error);
    return { ok: true };
  });

export const getGymAdReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      daily: { day: string; impressions: number; clicks: number }[];
      totals: { impressions: number; clicks: number };
    }> => {
      const { supabase } = context;
      const { data, error } = await supabase.rpc("gym_ad_daily", { _days: 30 });
      if (error) fail(error);
      const daily = ((data ?? []) as any[]).map((r) => ({
        day: r.day as string,
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
      }));
      return {
        daily,
        totals: {
          impressions: daily.reduce((s, r) => s + r.impressions, 0),
          clicks: daily.reduce((s, r) => s + r.clicks, 0),
        },
      };
    },
  );

export type PlatformAdForGym = {
  id: string;
  advertiser_name: string;
  headline: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  placement: AdPlacement;
  starts_on: string;
  ends_on: string | null;
  blocked: boolean;
  imageUrl: string | null;
};

export const listPlatformAdsForGym = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformAdForGym[]> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("platform_ads_for_gym");
    if (error) fail(error);
    return Promise.all(
      ((data ?? []) as any[]).map(async (a) => ({
        ...a,
        imageUrl: await signPath(supabase, a.image_path ?? null),
      })),
    );
  });

export const setPlatformAdBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ adId: z.string().uuid(), blocked: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const gymId = await requireAdminGym(supabase, userId);
    if (data.blocked) {
      const { error } = await supabase
        .from("gym_ad_blocklist")
        .upsert({ gym_id: gymId, ad_id: data.adId }, { onConflict: "gym_id,ad_id" });
      if (error) fail(error);
    } else {
      const { error } = await supabase
        .from("gym_ad_blocklist")
        .delete()
        .eq("gym_id", gymId)
        .eq("ad_id", data.adId);
      if (error) fail(error);
    }
    return { ok: true };
  });

// ======================= creative upload =======================

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_BYTES = 500 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Upload an ad creative and return its storage OBJECT PATH.
 * Type and size are enforced here, server-side — the file picker is only a hint.
 */
export const uploadAdCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        contentType: z.enum(ALLOWED_TYPES, {
          message: "Use a PNG, JPEG or WebP image",
        }),
        base64: z.string().min(1),
        scope: z.enum(["gym", "platform"]).default("gym"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ path: string; url: string | null }> => {
    const { supabase, userId } = context;

    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength === 0) throw new Error("That file looks empty");
    if (bytes.byteLength > MAX_BYTES) throw new Error("Images must be 500KB or smaller");

    let folder: string;
    if (data.scope === "platform") {
      const { data: isPlatform, error } = await supabase.rpc("is_platform_admin");
      if (error) fail(error);
      if (!isPlatform) throw new Error("Forbidden");
      folder = "platform";
    } else {
      folder = await requireAdminGym(supabase, userId);
    }

    const path = `${folder}/${crypto.randomUUID()}.${EXT[data.contentType]}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) fail(upErr as any);

    return { path, url: await signPath(supabase, path) };
  });

// ======================= platform admin =======================

export const listPlatformAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdRow[]> => {
    const { supabase } = context;
    const { data: isPlatform, error: guardErr } = await supabase.rpc("is_platform_admin");
    if (guardErr) fail(guardErr);
    if (!isPlatform) throw new Error("Forbidden");

    const { data, error } = await supabase
      .from("ads")
      .select("*")
      .is("gym_id", null)
      .order("created_at", { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as any[]).map((a) => ({
      ...a,
      impressions: 0,
      clicks: 0,
      ctr: null,
    })) as AdRow[];
  });

async function requirePlatform(supabase: any): Promise<void> {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) fail(error);
  if (!data) throw new Error("Forbidden");
}

export const createPlatformAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    await requirePlatform(supabase);
    const { data: row, error } = await supabase
      .from("ads")
      .insert(adRecord(data, null, userId))
      .select("id")
      .single();
    if (error) fail(error);
    const id = (row as { id: string }).id;
    await supabase.rpc("platform_set_gym_ad_note" as any, {} as any).catch(() => {});
    return { id };
  });

export const updatePlatformAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    adInputSchema.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await requirePlatform(supabase);
    const { id, ...rest } = data;
    const { created_by: _ignored, ...patch } = adRecord(rest as AdInput, null, userId);
    const { error } = await supabase.from("ads").update(patch).eq("id", id).is("gym_id", null);
    if (error) fail(error);
    return { ok: true };
  });

export type PlatformAdReport = {
  campaigns: {
    ad_id: string;
    advertiser_name: string;
    headline: string;
    placement: AdPlacement;
    status: AdStatus;
    starts_on: string;
    ends_on: string | null;
    impressions: number;
    clicks: number;
    gyms_served: number;
    by_gym: { gym_id: string; gym_name: string | null; impressions: number; clicks: number }[];
  }[];
  gyms: {
    gym_id: string;
    gym_name: string;
    slug: string;
    is_enabled: boolean;
    ads_enabled: boolean;
    allow_platform_fill: boolean;
    max_per_member_day: number;
    revenue_note: string | null;
    member_count: number;
  }[];
  fill_enabled_gyms: number;
};

export const getPlatformAdReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformAdReport> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("platform_ad_report", { _days: 30 });
    if (error) fail(error);
    return data as unknown as PlatformAdReport;
  });

export const setGymAdRevenueNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ gymId: z.string().uuid(), note: z.string().max(500) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("platform_set_gym_ad_note", {
      _gym_id: data.gymId,
      _note: data.note,
    });
    if (error) fail(error);
    return { ok: true };
  });

// ======================= member-facing =======================

/** Serve ads for a placement. Returns [] for staff, opted-out gyms and on any error. */
export const serveAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ placement: placementSchema, limit: z.number().int().min(1).max(3).default(1) })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ads: ServedAd[]; maxPerMemberDay: number }> => {
    const { supabase } = context;
    try {
      const [served, settings] = await Promise.all([
        supabase.rpc("ad_serve", { _placement: data.placement, _limit: data.limit }),
        supabase.from("gym_ad_settings").select("max_per_member_day").maybeSingle(),
      ]);
      if (served.error) return { ads: [], maxPerMemberDay: 3 };
      const ads = await Promise.all(
        ((served.data ?? []) as any[]).map(async (a) => ({
          id: a.id as string,
          advertiserName: a.advertiser_name as string,
          headline: a.headline as string,
          body: (a.body ?? null) as string | null,
          imageUrl: await signPath(supabase, a.image_path ?? null),
          ctaLabel: (a.cta_label ?? null) as string | null,
          ctaUrl: (a.cta_url ?? null) as string | null,
          isPlatform: Boolean(a.is_platform),
        })),
      );
      return {
        ads,
        maxPerMemberDay: Number((settings.data as any)?.max_per_member_day ?? 3),
      };
    } catch {
      return { ads: [], maxPerMemberDay: 3 };
    }
  });

/** Count an impression or a click. Aggregate only — nothing about who saw it. */
export const recordAdEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ adId: z.string().uuid(), event: z.enum(["impression", "click"]) })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    try {
      await context.supabase.rpc("ad_record_event", { _ad_id: data.adId, _event: data.event });
    } catch {
      // counting is best-effort; never break the member UI
    }
    return { ok: true };
  });
