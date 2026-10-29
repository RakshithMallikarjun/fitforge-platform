// @ts-nocheck -- run with bun test; follows existing project test convention
import { describe, expect, test } from "bun:test";
import {
  CUSTOM_DOMAIN_CNAME_TARGET,
  PUBLIC_APP_URL,
  publicGymUrl,
  validateCustomDomain,
  gymSiteUrl,
  gymSlugFromHost,
  gymHostDecision,
} from "./public-config";
import { getGymAuthRedirectUrl } from "./authRedirect";

describe("public config", () => {
  test("Ironworks uses its Fit Foundry subdomain", () => {
    expect(gymSiteUrl("ironworks", "/auth")).toBe("https://ironworks.fitfoundry.in/auth");
    expect(gymSlugFromHost("ironworks.fitfoundry.in")).toBe("ironworks");
    expect(gymSlugFromHost("ironworks.other.in")).toBeNull();
    expect(gymSlugFromHost("www.fitfoundry.in")).toBeNull();
    expect(gymSlugFromHost("other.ironworks.fitfoundry.in")).toBeNull();
    expect(() => gymSiteUrl("api")).toThrow();
  });
  test("Ironworks logins remain on Ironworks and other gyms are rejected", () => {
    expect(gymHostDecision("ironworks.fitfoundry.in", "ironworks")).toBe("stay");
    expect(gymHostDecision("ironworks.fitfoundry.in", "othergym")).toBe("reject");
    expect(gymHostDecision("ironworks.fitfoundry.in", null)).toBe("reject");
  });
  test("root gym logins forward without breaking local and preview testing", () => {
    expect(gymHostDecision("fitfoundry.in", "ironworks")).toBe("forward");
    expect(gymHostDecision("localhost:8080", "ironworks")).toBe("stay");
    expect(gymHostDecision("id-preview--example.lovable.app", "ironworks")).toBe("stay");
    expect(gymHostDecision("fitfoundry.in", null)).toBe("stay");
  });
  test("gym invites return to Ironworks rather than an external domain", () => {
    expect(getGymAuthRedirectUrl({ slug: "ironworks", custom_domain: "app.oldgym.com" }, "/accept-invite")).toBe("https://ironworks.fitfoundry.in/accept-invite");
  });
  test("brand URL and branded CNAME target", () => {
    expect(PUBLIC_APP_URL).toBe("https://fitfoundry.in");
    expect(CUSTOM_DOMAIN_CNAME_TARGET).toBe("custom.fitfoundry.in");
  });
  test("rejects hosting host and the brand domain", () => {
    expect(validateCustomDomain("fitffoundry.lovable.app")).not.toBeNull();
    expect(validateCustomDomain("fitfoundry.in")).not.toBeNull();
    expect(validateCustomDomain("https://app.gym.com")).not.toBeNull();
    expect(validateCustomDomain("app.gym.com/x")).not.toBeNull();
    expect(validateCustomDomain("App.Gym.com")).not.toBeNull();
    expect(validateCustomDomain("app.yourgym.com")).toBeNull();
  });
  test("gym links use active custom domain, else brand URL", () => {
    expect(publicGymUrl("/accept-invite")).toBe("https://fitfoundry.in/accept-invite");
    expect(publicGymUrl("/auth", "app.yourgym.com")).toBe("https://app.yourgym.com/auth");
  });
});
