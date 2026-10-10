// @ts-nocheck -- run with `bun test`; bun types are not installed in this project
import { describe, expect, it } from "bun:test";
import { goalPercent, goalStatus } from "./goal-progress";

describe("goal progress", () => {
  it("Strength goal: best bench 62.5 toward 80 kg is 78%", () => {
    expect(goalPercent(62.5, 80, "up", null)).toBe(78);
  });

  it("Body goal going down: 82 kg toward 77 kg starts at 0% and is achieved at 77", () => {
    expect(goalPercent(82, 77, "down", 82)).toBe(0);
    expect(goalPercent(79.5, 77, "down", 82)).toBe(50);
    expect(goalPercent(77, 77, "down", 82)).toBe(100);
  });

  it("an unmet goal past its date is Overdue; a met goal is Achieved", () => {
    const base = { target: 80, direction: "up", achievedAt: null, today: "2026-10-10" };
    expect(goalStatus({ ...base, current: 60, targetDate: "2026-10-09" })).toBe("overdue");
    expect(goalStatus({ ...base, current: 80, targetDate: "2026-10-09" })).toBe("achieved");
    expect(goalStatus({ ...base, current: 60, targetDate: "2026-10-10" })).toBe("in_progress");
  });
});
