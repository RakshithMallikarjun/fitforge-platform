import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberProfileData = {
  id: string;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  latestAssessment: {
    date: string;
    weight: number | null;
    bodyFatPct: number | null;
  } | null;
};

export const getMemberProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberProfileData> => {
    const { supabase, userId } = context;

    const [{ data: user }, { data: assessment }] = await Promise.all([
      supabase
        .from("users")
        .select("id, display_name, email, photo_url")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("fitness_assessments")
        .select("date, weight, body_fat_pct")
        .eq("member_id", userId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      id: userId,
      displayName: (user as any)?.display_name ?? null,
      email: (user as any)?.email ?? null,
      photoUrl: (user as any)?.photo_url ?? null,
      latestAssessment: assessment
        ? {
            date: (assessment as any).date,
            weight: (assessment as any).weight ?? null,
            bodyFatPct: (assessment as any).body_fat_pct ?? null,
          }
        : null,
    };
  });

export const updateMyDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { displayName: string }) =>
    z.object({ displayName: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("users")
      .update({ display_name: data.displayName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
