/** Fixed vocabularies for the exercise library. Values are lower-case. */
export const MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms", "abs", "core",
  "glutes", "quadriceps", "hamstrings", "calves", "hip flexors", "adductors", "traps", "lats", "neck",
] as const;

export const EQUIPMENT = [
  "bodyweight", "barbell", "dumbbells", "kettlebells", "cable", "machine", "bench", "rack",
  "pull-up bar", "bands", "smith machine", "ez bar", "medicine ball", "trx",
] as const;

const EQUIPMENT_ALIASES: Record<string, string> = {
  dumbbell: "dumbbells",
  kettlebell: "kettlebells",
  cables: "cable",
  machines: "machine",
  barbells: "barbell",
  benches: "bench",
  band: "bands",
};

/** Split comma-joined entries, trim, lower-case, de-duplicate. */
export function normaliseTags(values: string[], kind: "muscle" | "equipment"): string[] {
  const out = new Set<string>();
  for (const v of values) {
    for (const part of v.split(",")) {
      let t = part.trim().toLowerCase().replace(/\s+/g, " ");
      if (!t) continue;
      if (kind === "equipment") t = EQUIPMENT_ALIASES[t] ?? t;
      if (t.length > 40) t = t.slice(0, 40);
      out.add(t);
    }
  }
  return Array.from(out);
}

/** youtube.com/watch?v=, youtu.be/<id>, youtube.com/shorts/<id> only. */
export function isYoutubeUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.replace(/^(www\.|m\.)/, "");
    const id = /^[A-Za-z0-9_-]{6,}$/;
    if (host === "youtu.be") return id.test(u.pathname.slice(1));
    if (host !== "youtube.com") return false;
    if (u.pathname === "/watch") return id.test(u.searchParams.get("v") ?? "");
    const m = u.pathname.match(/^\/shorts\/([^/]+)/);
    return !!m && id.test(m[1]);
  } catch {
    return false;
  }
}
