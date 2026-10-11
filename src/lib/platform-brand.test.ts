// @ts-nocheck -- run with `bun test`; bun types are not installed in this project
import { describe, expect, it } from "bun:test";
import { SUPPORT_WHATSAPP, formatSupportWhatsapp, supportWhatsappUrl } from "./platform-brand";

describe("Fit Foundry support WhatsApp", () => {
  it("displays as +91 98454 32219 and links to wa.me", () => {
    expect(formatSupportWhatsapp()).toBe("+91 98454 32219");
    expect(supportWhatsappUrl()).toBe(`https://wa.me/${SUPPORT_WHATSAPP}`);
    expect(supportWhatsappUrl("Hi there")).toBe(`https://wa.me/${SUPPORT_WHATSAPP}?text=Hi%20there`);
  });
});
