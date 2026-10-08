import { describe, expect, it } from "bun:test";
import { isYoutubeUrl, normaliseTags } from "./exercise-taxonomy";

describe("exercise taxonomy", () => {
  it("accepts only YouTube watch, youtu.be and shorts links", () => {
    expect(isYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isYoutubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
    expect(isYoutubeUrl("https://example.com/not-youtube")).toBe(false);
  });
  it("splits comma-joined muscles into separate chips", () => {
    expect(normaliseTags(["Quadriceps, Glutes"], "muscle")).toEqual(["quadriceps", "glutes"]);
  });
  it("merges dumbbell into dumbbells", () => {
    expect(normaliseTags(["dumbbell", "dumbbells"], "equipment")).toEqual(["dumbbells"]);
  });
});
