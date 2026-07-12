import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export function getYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] ?? null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function getYoutubeEmbedUrl(url: string): string | null {
  const id = getYoutubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function getYoutubeThumbnail(url: string): string {
  const id = getYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : "";
}

type Role = "admin" | "trainer" | "member";

async function getRolesAndGym(supabase: any, userId: string) {
  const [{ data: u }, { data: roles }] = await Promise.all([
    supabase.from("users").select("gym_id").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const r = (roles ?? []).map((x: any) => x.role as Role);
  return {
    gymId: u?.gym_id as string | null,
    isAdmin: r.includes("admin"),
    isTrainer: r.includes("trainer"),
  };
}

export type ExerciseRow = {
  id: string;
  gym_id: string | null;
  name: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  muscle_groups: string[];
  equipment: string[];
  difficulty: string | null;
  created_by: string | null;
};

const listSchema = z
  .object({
    search: z.string().optional(),
    muscleGroups: z.array(z.string()).optional(),
    equipment: z.array(z.string()).optional(),
    difficulty: z.string().optional(),
  })
  .optional();

export const listExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listSchema.parse(data) ?? {})
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("exercises")
      .select("*")
      .order("name", { ascending: true });
    if (data?.search) q = q.ilike("name", `%${data.search}%`);
    if (data?.muscleGroups?.length) q = q.overlaps("muscle_groups", data.muscleGroups);
    if (data?.equipment?.length) q = q.overlaps("equipment", data.equipment);
    if (data?.difficulty) q = q.eq("difficulty", data.difficulty);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ExerciseRow[];
  });

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  video_url: z.string().optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
  muscle_groups: z.array(z.string()).default([]),
  equipment: z.array(z.string()).default([]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional().nullable(),
});

export const createExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin, isTrainer } = await getRolesAndGym(supabase, userId);
    if (!gymId) throw new Error("No gym");
    if (!isAdmin && !isTrainer) throw new Error("Forbidden");
    const { data: row, error } = await supabase
      .from("exercises")
      .insert({ ...data, gym_id: gymId, created_by: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as ExerciseRow;
  });

export const updateExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), patch: createSchema.partial() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { gymId } = await getRolesAndGym(supabase, userId);
    if (!gymId) throw new Error("No gym");
    const { error } = await supabase
      .from("exercises")
      .update(data.patch)
      .eq("id", data.id)
      .eq("gym_id", gymId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { gymId, isAdmin } = await getRolesAndGym(supabase, userId);
    if (!gymId || !isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("exercises")
      .delete()
      .eq("id", data.id)
      .eq("gym_id", gymId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getExerciseAlternatives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        exerciseId: z.string().uuid(),
        muscleGroup: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const { data: target } = await supabase
      .from("exercises")
      .select("id, muscle_groups")
      .eq("id", data.exerciseId)
      .maybeSingle();

    const groups: string[] = data.muscleGroup
      ? [data.muscleGroup]
      : ((target as any)?.muscle_groups ?? []);

    if (!groups.length) return [] as ExerciseRow[];

    const difficultyOrder = ["beginner", "intermediate", "advanced"];
    const { data: rows, error } = await supabase
      .from("exercises")
      .select("*")
      .overlaps("muscle_groups", groups)
      .neq("id", data.exerciseId)
      .limit(20);
    if (error) throw new Error(error.message);

    const sorted = (rows ?? []).slice().sort((a: any, b: any) => {
      const ai = difficultyOrder.indexOf(a.difficulty ?? "");
      const bi = difficultyOrder.indexOf(b.difficulty ?? "");
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return sorted.slice(0, 5) as ExerciseRow[];
  });

export const substituteExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        workoutExerciseId: z.string().uuid(),
        newExerciseId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Verify caller is the member assigned to the plan containing this workout_exercise
    const { data: we } = await supabase
      .from("workout_exercises")
      .select("id, workout_days:day_id(plan_id, workout_plans:plan_id(member_id))")
      .eq("id", data.workoutExerciseId)
      .maybeSingle();

    const memberId = (we as any)?.workout_days?.workout_plans?.member_id;
    if (!memberId || memberId !== userId) throw new Error("Forbidden");

    const { data: row, error } = await supabase
      .from("workout_exercise_substitutions")
      .upsert(
        {
          original_workout_exercise_id: data.workoutExerciseId,
          substitute_exercise_id: data.newExerciseId,
          member_id: userId,
        },
        { onConflict: "original_workout_exercise_id,member_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
