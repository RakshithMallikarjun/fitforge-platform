// @ts-nocheck -- run with bun test, following project test conventions
import { describe, it, expect } from "bun:test";
import {
  canReadLibraryPlan,
  canEditLibraryExercise,
  filterLibrary,
  librarySearch,
} from "./exercise-library";
const bench = {
  id: "bench",
  gym_id: null,
  name: "Bench Press",
  muscle_groups: ["chest"],
  equipment: ["barbell"],
  difficulty: "intermediate",
};
const gymExercise = { ...bench, id: "gym", gym_id: "my-gym", name: "Local Press" };
describe("exercise library role rules", () => {
  it("allows admins to edit Gym exercises, not Global exercises", () => {
    expect(canEditLibraryExercise(true, "my-gym", gymExercise)).toBe(true);
    expect(canEditLibraryExercise(true, "my-gym", bench)).toBe(false);
    expect(canEditLibraryExercise(true, "other-gym", gymExercise)).toBe(false);
  });
  it("hides Edit/Delete from trainers", () => {
    expect(canEditLibraryExercise(false, "my-gym", gymExercise)).toBe(false);
  });
  it("shows trainers only assigned members' plans and templates", () => {
    const assigned = new Set(["assigned-member"]);
    expect(canReadLibraryPlan(false, "assigned-member", false, assigned)).toBe(true);
    expect(canReadLibraryPlan(false, "other-member", false, assigned)).toBe(false);
    expect(canReadLibraryPlan(false, null, true, assigned)).toBe(true);
    expect(canReadLibraryPlan(false, null, false, assigned)).toBe(false);
  });
  it("shows admins all gym plans", () => {
    expect(canReadLibraryPlan(true, "other-member", false, new Set())).toBe(true);
  });
  it("combines URL name, muscle, equipment and scope filters", () => {
    const filters = librarySearch({
      q: "bench",
      muscle: "chest",
      equipment: "barbell",
      scope: "global",
    });
    expect(filterLibrary([gymExercise, bench], filters).map((e) => e.id)).toEqual(["bench"]);
    expect(filterLibrary([bench], { ...filters, equipment: "dumbbell" })).toEqual([]);
  });
});
