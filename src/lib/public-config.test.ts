// @ts-nocheck -- run with bun test; follows existing project test convention
import { describe, expect, test } from "bun:test";
import {
  CUSTOM_DOMAIN_CNAME_TARGET,
  PUBLIC_APP_URL,
  publicGymUrl,
  validateCustomDomain,
} from "./public-config";

describe("public config", () => {
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
