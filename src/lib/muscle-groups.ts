/** Rank muscle groups by how many exercises hit them, keep 4, add a "+N more" chip. */
export function rankMuscleGroups(all: string[]): string[] {
  const counts = new Map<string, number>();
  for (const m of all) counts.set(m, (counts.get(m) ?? 0) + 1);
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([m]) => m);
  if (ranked.length <= 4) return ranked;
  return [...ranked.slice(0, 4), `+${ranked.length - 4} more`];
}
