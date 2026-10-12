// @ts-nocheck -- run with bun test; follows existing project test convention
import { describe, expect, test } from "bun:test";
import { accessibleBrand, contrastRatio, DARK_SURFACE } from "./brand-contrast";

const BRANDS = ["#059669", "#facc15", "#22d3ee", "#ef4444", "#1e3a8a", "#ffffff", "#000000"];

describe("gym brand colour contrast (WCAG AA 4.5:1)", () => {
  for (const hex of BRANDS) {
    test(`${hex} brand text and buttons reach 4.5:1`, () => {
      const b = accessibleBrand(hex);
      expect(contrastRatio(b.light, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(b.light, b.lightForeground)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(b.dark, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(b.dark, b.darkForeground)).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("muted text on white card reaches 4.5:1", () => {
    // slate-600, used for --muted-foreground in light theme
    expect(contrastRatio("#475569", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#475569", "#f1f5f9")).toBeGreaterThanOrEqual(4.5);
  });
});
