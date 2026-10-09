/** Pure helpers for workout logging, PRs, swaps and history. No I/O. */

/** Epley estimated one-rep max: w × (1 + reps/30). */
export function epley1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  const r = Number.isFinite(reps) && reps > 0 ? reps : 1;
  return weight * (1 + r / 30);
}

type LoggedSet = {
  exercise_id: string;
  weight: number | string | null;
  reps: number | string | null;
  completed: boolean | null;
};

/** Per exercise, the completed set with the highest estimated 1RM. */
export function pickBestSets(
  sets: LoggedSet[],
): Map<string, { weight: number; reps: number; e1rm: number }> {
  const best = new Map<string, { weight: number; reps: number; e1rm: number }>();
  for (const s of sets) {
    if (!s.completed || s.weight == null) continue;
    const w = Number(s.weight);
    const r = Number(s.reps ?? 0);
    if (!Number.isFinite(w) || w <= 0) continue;
    const e1rm = epley1RM(w, r);
    const cur = best.get(s.exercise_id);
    if (!cur || e1rm > cur.e1rm) best.set(s.exercise_id, { weight: w, reps: r, e1rm });
  }
  return best;
}

const PATTERNS: [string, RegExp][] = [
  ["squat", /squat|lunge|leg press|step[- ]?up|split|hack|leg extension/i],
  ["hinge", /deadlift|rdl|romanian|hip thrust|good morning|swing|glute bridge|hamstring curl|leg curl/i],
  ["horizontal_push", /bench|push[- ]?up|chest press|fly|dip/i],
  ["vertical_push", /overhead|shoulder press|military|arnold|lateral raise|pike/i],
  ["horizontal_pull", /row|face pull|rear delt/i],
  ["vertical_pull", /pull[- ]?up|chin[- ]?up|pulldown|pull-down/i],
  ["core", /plank|crunch|twist|sit[- ]?up|leg raise|dead bug|hollow|ab wheel|rollout|mountain/i],
  ["curl", /curl/i],
  ["triceps", /tricep|skull|pushdown|kickback/i],
];

export function movementPattern(name: string): string | null {
  for (const [p, re] of PATTERNS) if (re.test(name)) return p;
  return null;
}

type Candidate = { id: string; name: string; muscle_groups: string[] | null };

/**
 * Rank swap alternatives by the target's PRIMARY (first) muscle and movement pattern.
 * Secondary-muscle matches are only used when fewer than 3 primary matches exist,
 * and are flagged `differentFocus`.
 */
export function rankAlternatives<T extends Candidate>(
  target: { name: string; muscle_groups: string[] | null },
  candidates: T[],
  limit = 5,
): (T & { differentFocus: boolean })[] {
  const groups = (target.muscle_groups ?? []).map((g) => g.toLowerCase());
  const primary = groups[0];
  const pattern = movementPattern(target.name);
  const scored = candidates.map((c) => {
    const cg = (c.muscle_groups ?? []).map((g) => g.toLowerCase());
    const samePrimary = !!primary && cg[0] === primary;
    const samePattern = !!pattern && movementPattern(c.name) === pattern;
    const hitsPrimary = !!primary && cg.includes(primary);
    const score = (samePattern ? 4 : 0) + (samePrimary ? 2 : 0) + (hitsPrimary ? 1 : 0);
    const primaryMatch = samePattern || samePrimary;
    const shared = cg.filter((g) => groups.includes(g)).length;
    return { c, score, primaryMatch, shared };
  });
  const primaryMatches = scored
    .filter((s) => s.primaryMatch)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .map((s) => ({ ...s.c, differentFocus: false }));
  if (primaryMatches.length >= 3) return primaryMatches.slice(0, limit);
  const fallback = scored
    .filter((s) => !s.primaryMatch && s.shared > 0)
    .sort((a, b) => b.score - a.score || b.shared - a.shared || a.c.name.localeCompare(b.c.name))
    .map((s) => ({ ...s.c, differentFocus: true }));
  return [...primaryMatches, ...fallback].slice(0, limit);
}

/**
 * Count exercises performed in a session: a substitute replaces its original,
 * so logging both still counts once.
 */
export function countSessionExercises(
  loggedExerciseIds: string[],
  substitutions: { original_exercise_id: string; substitute_exercise_id: string }[],
): number {
  const ids = new Set(loggedExerciseIds);
  for (const s of substitutions) {
    if (ids.has(s.substitute_exercise_id)) ids.delete(s.original_exercise_id);
  }
  return ids.size;
}
