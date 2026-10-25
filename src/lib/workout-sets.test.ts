// @ts-nocheck -- run with `bun test`; bun types are not installed in this project
import { describe, expect, test } from "bun:test";
import {
  addSetRow,
  applySetPatch,
  emptySet,
  fillFromPrevious,
  removeSetRow,
  type SetState,
} from "./workout-sets";

function threeRows(): SetState[] {
  return [emptySet(), emptySet(), emptySet()];
}

describe("workout set rows stay independent", () => {
  test("editing set 1 never changes sets 2 and 3", () => {
    let rows = threeRows();
    rows = applySetPatch(rows, 0, { weight: "60", reps: "10" });
    expect(rows[0]).toMatchObject({ weight: "60", reps: "10" });
    expect(rows[1]).toEqual(emptySet());
    expect(rows[2]).toEqual(emptySet());

    rows = applySetPatch(rows, 1, { weight: "62.5", reps: "9" });
    rows = applySetPatch(rows, 2, { weight: "62.5", reps: "8" });
    expect(rows.map((r) => `${r.weight}x${r.reps}`)).toEqual(["60x10", "62.5x9", "62.5x8"]);
  });

  test("marking set 1 done locks only that set", () => {
    let rows = threeRows();
    rows = applySetPatch(rows, 0, { done: true });
    expect(rows[0].done).toBe(true);
    expect(rows[1].done).toBe(false);
    expect(rows[2].done).toBe(false);
  });

  test("timed sets keep their own seconds", () => {
    let rows = threeRows();
    rows = applySetPatch(rows, 0, { seconds: "30" });
    rows = applySetPatch(rows, 1, { seconds: "45" });
    expect(rows[0].seconds).toBe("30");
    expect(rows[1].seconds).toBe("45");
    expect(rows[2].seconds).toBe("");
  });

  test("add set appends an independent row seeded from the previous set", () => {
    let rows = applySetPatch(threeRows(), 2, { weight: "62.5", reps: "8" });
    rows = addSetRow(rows);
    expect(rows).toHaveLength(4);
    expect(rows[3]).toMatchObject({ weight: "62.5", reps: "8", done: false });
    // The copy is one-off: editing the new row leaves set 3 alone.
    rows = applySetPatch(rows, 3, { weight: "65" });
    expect(rows[2].weight).toBe("62.5");
    expect(rows[3].weight).toBe("65");
  });

  test("remove set drops only that row and keeps the others' values", () => {
    let rows = threeRows();
    rows = applySetPatch(rows, 0, { weight: "60", reps: "10" });
    rows = applySetPatch(rows, 1, { weight: "62.5", reps: "9" });
    rows = applySetPatch(rows, 2, { weight: "62.5", reps: "8" });
    rows = removeSetRow(rows, 1);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => `${r.weight}x${r.reps}`)).toEqual(["60x10", "62.5x8"]);
  });

  test("Use last fills only the chosen set", () => {
    let rows = threeRows();
    rows = fillFromPrevious(rows, 1, { weight: 50, reps: 12, duration_seconds: null });
    expect(rows[1]).toMatchObject({ weight: "50", reps: "12" });
    expect(rows[0]).toEqual(emptySet());
    expect(rows[2]).toEqual(emptySet());
  });
});
