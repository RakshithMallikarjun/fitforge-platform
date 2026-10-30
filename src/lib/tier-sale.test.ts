import { describe, expect, it } from "bun:test";
import { hasTierPrice, isSellableTier, needsSaleConfirmation } from "./tier-sale";

describe("tier sale rules", () => {
  it("requires at least one priced term, including a valid zero price", () => {
    expect(hasTierPrice([])).toBe(false);
    expect(hasTierPrice([{ price: 0 }])).toBe(true);
    expect(hasTierPrice([{ price: NaN }])).toBe(false);
  });
  it("stops new sales for inactive or archived tiers", () => {
    const tier = { is_active: true, archived_at: null, member_count: 2, prices: [{ price: 100, is_enabled: true }] };
    expect(isSellableTier(tier)).toBe(true);
    expect(isSellableTier({ ...tier, is_active: false })).toBe(false);
    expect(isSellableTier({ ...tier, archived_at: "2026-10-30" })).toBe(false);
    expect(isSellableTier({ ...tier, prices: [{ price: 100, is_enabled: false }] })).toBe(false);
  });
  it("requires confirmation only when stopping sales with active members", () => {
    expect(needsSaleConfirmation({ member_count: 2 }, false)).toBe(true);
    expect(needsSaleConfirmation({ member_count: 0 }, false)).toBe(false);
    expect(needsSaleConfirmation({ member_count: 2 }, true)).toBe(false);
  });
});