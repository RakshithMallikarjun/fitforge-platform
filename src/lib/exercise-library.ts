import type { ExerciseRow } from "@/lib/exercises.functions";

export const librarySearch = (search: Record<string, unknown>) => ({
  q: typeof search.q === "string" ? search.q : "",
  muscle: typeof search.muscle === "string" ? search.muscle : "all",
  equipment: typeof search.equipment === "string" ? search.equipment : "all",
  scope: typeof search.scope === "string" ? search.scope : "all",
  level: typeof search.level === "string" ? search.level : "all",
  sort: typeof search.sort === "string" ? search.sort : "asc",
  view: typeof search.view === "string" ? search.view : "grid",
  tab: typeof search.tab === "string" ? search.tab : "exercises",
  template: typeof search.template === "string" ? search.template : "",
});
export type LibrarySearch = ReturnType<typeof librarySearch>;
export function filterLibrary(rows: ExerciseRow[], filters: LibrarySearch) {
  return rows
    .filter(
      (e) =>
        e.name.toLowerCase().includes(filters.q.trim().toLowerCase()) &&
        (filters.muscle === "all" || e.muscle_groups.includes(filters.muscle)) &&
        (filters.equipment === "all" || e.equipment.includes(filters.equipment)) &&
        (filters.scope === "all" ||
          (filters.scope === "global" ? e.gym_id === null : e.gym_id !== null)) &&
        (filters.level === "all" || e.difficulty === filters.level),
    )
    .sort((a, b) =>
      filters.sort === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
    );
}
export function canEditLibraryExercise(
  isAdmin: boolean,
  gymId: string | null,
  exercise: ExerciseRow,
) {
  return isAdmin && !!gymId && exercise.gym_id === gymId;
}
export function canReadLibraryPlan(
  isAdmin: boolean,
  memberId: string | null,
  template: boolean,
  assigned: Set<string>,
) {
  return isAdmin || template || (!!memberId && assigned.has(memberId));
}
