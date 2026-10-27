import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { emailLinks, MAIL_APP_WAIT_MS } from "./contact-email";

describe("email contact rules", () => {
  test("mail app and Gmail keep the same recipient, subject and editable body", () => {
    const links = emailLinks(" owner@example.com ", "Checking in on Iron & Steel", "Hi Owner,\n\nHow are things?\nRakshith");
    assert.ok(links);
    const gmail = new URL(links?.gmail ?? "");
    const mail = new URL(links?.mailto ?? "");
    assert.equal(decodeURIComponent(mail.pathname), "owner@example.com");
    assert.equal(gmail.searchParams.get("to"), "owner@example.com");
    assert.equal(mail.searchParams.get("subject"), "Checking in on Iron & Steel");
    assert.equal(gmail.searchParams.get("su"), mail.searchParams.get("subject"));
    assert.equal(gmail.searchParams.get("body"), "Hi Owner,\n\nHow are things?\nRakshith");
  });
  test("missing or malformed addresses never generate a link", () => {
    for (const value of [null, undefined, "", " ", "undefined", "owner@example.com?bcc=other@example.com"]) assert.equal(emailLinks(value), null);
  });
  test("mail-app fallback waits 1.5 seconds", () => { assert.equal(MAIL_APP_WAIT_MS, 1500); });
});