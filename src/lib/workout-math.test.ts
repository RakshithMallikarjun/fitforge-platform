// @ts-nocheck -- run with `bun test`; bun types are not installed in this project
import { describe, expect, it } from "bun:test";
import { countSessionExercises, epley1RM, pickBestSets, rankAlternatives } from "./workout-math";

describe("workout math", () => {
  it("PR is the set with the highest Epley 1RM: 62.5×9 beats 62.5×8", () => {
    const best = pickBestSets([
      { exercise_id: "x", weight: 62.5, reps: 9, completed: true },
      { exercise_id: "x", weight: 62.5, reps: 8, completed: true },
    ]);
    expect(best.get("x")).toMatchObject({ weight: 62.5, reps: 9 });
    expect(epley1RM(100, 30)).toBe(200);
  });

  it("Back Squat alternatives start with squat-pattern lifts, not Push Up", () => {
    const target = { name: "Back Squat", muscle_groups: ["quadriceps", "glutes", "core"] };
    const out = rankAlternatives(target, [
      { id: "1", name: "Push Up", muscle_groups: ["chest", "triceps", "core"] },
      { id: "2", name: "Plank", muscle_groups: ["core", "abs"] },
      { id: "3", name: "Russian Twist", muscle_groups: ["abs", "core"] },
      { id: "4", name: "Leg Press", muscle_groups: ["quadriceps", "glutes"] },
      { id: "5", name: "Goblet Squat", muscle_groups: ["quadriceps", "glutes"] },
      { id: "6", name: "Lunges", muscle_groups: ["quadriceps", "glutes", "hamstrings"] },
    ]);
    expect(out.slice(0, 3).map((a) => a.name).sort()).toEqual(["Goblet Squat", "Leg Press", "Lunges"]);
    expect(out.some((a) => a.name === "Push Up")).toBe(false);
  });

  it("falls back to secondary muscles flagged Different focus when under 3 matches", () => {
    const out = rankAlternatives({ name: "Back Squat", muscle_groups: ["quadriceps", "core"] }, [
      { id: "4", name: "Leg Press", muscle_groups: ["quadriceps"] },
      { id: "2", name: "Plank", muscle_groups: ["core"] },
    ]);
    expect(out.map((a) => [a.name, a.differentFocus])).toEqual([
      ["Leg Press", false],
      ["Plank", true],
    ]);
  });

  it("a 4-exercise day with one swap counts 4 exercises", () => {
    expect(
      countSessionExercises(["a", "b", "c", "d", "s"], [
        { original_exercise_id: "d", substitute_exercise_id: "s" },
      ]),
    ).toBe(4);
  });
});
