// @ts-nocheck -- run with `bun test`; bun types are not installed in this project
import { describe, expect, it } from "bun:test";
import { formatJoinCode, generateJoinCode, normalizeJoinCode } from "./join-code-format";

describe("join codes", () => {
  it("are 8 characters with no 0/O/1/I and show in groups of 4", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateJoinCode();
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
    expect(formatJoinCode("ABCDEFGH")).toBe("ABCD EFGH");
  });
  it("compare case-insensitively, ignoring the space", () => {
    expect(normalizeJoinCode("abcd efgh")).toBe(normalizeJoinCode("ABCDEFGH"));
  });
});
