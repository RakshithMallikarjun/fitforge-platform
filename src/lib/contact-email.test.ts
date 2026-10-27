import { describe, expect, test } from "bun:test";
import { emailLinks, MAIL_APP_WAIT_MS } from "./contact-email";

describe("email contact rules", () => {
  test("mail app and Gmail keep the same recipient, subject and editable body", () => {
    const links = emailLinks(" owner@example.com ", "Checking in on Iron & Steel", "Hi Owner,\n\nHow are things?\nRakshith");
    expect(links).not.toBeNull();
    const gmail = new URL(links?.gmail ?? "");
    const mail = new URL(links?.mailto ?? "");
    expect(decodeURIComponent(mail.pathname)).toBe("owner@example.com");
    expect(gmail.searchParams.get("to")).toBe("owner@example.com");
    expect(mail.searchParams.get("subject")).toBe("Checking in on Iron & Steel");
    expect(gmail.searchParams.get("su")).toBe(mail.searchParams.get("subject"));
    expect(gmail.searchParams.get("body")).toBe("Hi Owner,\n\nHow are things?\nRakshith");
  });
  test("missing or malformed addresses never generate a link", () => {
    for (const value of [null, undefined, "", " ", "undefined", "owner@example.com?bcc=other@example.com"]) expect(emailLinks(value)).toBeNull();
  });
  test("mail-app fallback waits 1.5 seconds", () => { expect(MAIL_APP_WAIT_MS).toBe(1500); });
});