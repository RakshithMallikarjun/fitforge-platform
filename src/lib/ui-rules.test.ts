// @ts-nocheck -- run with bun test; follows existing project test convention
import { describe, expect, it } from "bun:test";
import { isNavActive } from "./copy";
import { notificationDeadline } from "./notification-deadline";

describe("console navigation", () => {
  it("does not activate Members for Membership tiers", () => {
    expect(isNavActive("/admin/membership-plans", "/admin/members")).toBe(false);
    expect(isNavActive("/admin/membership-plans", "/admin/membership-plans")).toBe(true);
  });
  it("activates a parent for a real child segment", () => {
    expect(isNavActive("/admin/members/123", "/admin/members")).toBe(true);
    expect(isNavActive("/admin/members/123", "/admin", true)).toBe(false);
  });
});

describe("error expiry", () => {
  it("sets a wall-clock deadline for errors longer than eight seconds", () => {
    expect(notificationDeadline("error", 9000)).toBe(9000);
  });
  it("leaves errors of eight seconds or less to the normal timer", () => {
    expect(notificationDeadline("error", 8000)).toBeNull();
  });
  it("preserves persistent errors and actionable success notifications", () => {
    expect(notificationDeadline("error", Infinity)).toBeNull();
    expect(notificationDeadline("success", 9000)).toBeNull();
  });
});
