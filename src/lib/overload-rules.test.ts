// @ts-nocheck -- run with `bun test`; bun types are not installed in this project
import { describe, expect, it } from "bun:test";
import { cleanReasoning, ruleTarget } from "./overload-rules";

describe("overload rules", () => {
  it("62.5 kg × 9 never suggests 62.5 × 9; next plate is 65", () => {
    const t = ruleTarget({ name: "Back Squat", tracking: "weight_reps", best: { weight: 62.5, reps: 9 }, bestReps: 9, bestSeconds: null });
    expect([t.suggestedWeight, t.suggestedReps]).toEqual([65, 8]);
  });

  it("when 2.5% rounds back to the same plate, add one rep", () => {
    const t = ruleTarget({ name: "Curl", tracking: "weight_reps", best: { weight: 10, reps: 9 }, bestReps: 9, bestSeconds: null });
    expect([t.suggestedWeight, t.suggestedReps]).toEqual([10, 10]);
  });

  it("timed exercises get +5 seconds; no history returns null", () => {
    expect(ruleTarget({ name: "Plank", tracking: "time", best: null, bestReps: null, bestSeconds: 45 }).suggestedSeconds).toBe(50);
    expect(ruleTarget({ name: "Plank", tracking: "time", best: null, bestReps: null, bestSeconds: null })).toBeNull();
  });

  it("strips error text from member-facing reasoning", () => {
    expect(cleanReasoning('AI unavailable ([ { "code": "too_small") — heuristic +2.5%.')).toBeNull();
    expect(cleanReasoning("Nice steady progress.")).toBe("Nice steady progress.");
  });
});
