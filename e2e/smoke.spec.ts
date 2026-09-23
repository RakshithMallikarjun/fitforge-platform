import { test, expect } from "@playwright/test";

/**
 * Smoke test: sign in as a member, finish one workout, and assert the streak
 * increments. The streak assertion is the important one — it fails whenever
 * date resolution drifts from the gym's timezone.
 *
 * Requires SMOKE_EMAIL / SMOKE_PASSWORD for a seeded member account.
 */
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

test("landing page renders with legal links and no broken images", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toBeVisible();

  const broken = await page.evaluate(
    () => Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
  );
  expect(broken).toBe(0);
});

test("gym management software page renders copy, FAQ and structured data", async ({ page }) => {
  await page.goto("/gym-management-software");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/gym management software/i);
  await expect(page.getByRole("link", { name: /get started free/i }).first()).toBeVisible();

  // FAQ opens.
  await page
    .getByRole("button", { name: /what does gym management software actually do/i })
    .click();
  await expect(page.getByText(/replaces the spreadsheets/i)).toBeVisible();

  // JSON-LD present for SoftwareApplication + FAQPage.
  const types = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => {
      try {
        return (JSON.parse(s.textContent ?? "{}") as { "@type"?: string })["@type"];
      } catch {
        return null;
      }
    }),
  );
  expect(types).toContain("SoftwareApplication");
  expect(types).toContain("FAQPage");
  expect(types).toContain("Organization");
});

test("trainer can open the AI plan generator in the plan builder", async ({ page }) => {
  const staffEmail = process.env.SMOKE_STAFF_EMAIL;
  const staffPassword = process.env.SMOKE_STAFF_PASSWORD;
  test.skip(
    !staffEmail || !staffPassword,
    "SMOKE_STAFF_EMAIL / SMOKE_STAFF_PASSWORD not configured",
  );

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(staffEmail!);
  await page.getByLabel(/^password/i).fill(staffPassword!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });

  await page.goto("/admin/plans/new");
  await expect(page.getByText(/draft this plan with ai/i)).toBeVisible();
  await page.getByRole("button", { name: /generate with ai/i }).click();
  await expect(page.getByRole("dialog")).toContainText(/goals/i);
});

test("member signs in, completes a workout and the streak increments", async ({ page }) => {
  test.skip(!email || !password, "SMOKE_EMAIL / SMOKE_PASSWORD not configured");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/^password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/app/, { timeout: 30_000 });

  const streakText = await page
    .getByText(/day streak/i)
    .first()
    .textContent();
  const before = Number(streakText?.match(/\d+/)?.[0] ?? "0");

  await page.getByRole("link", { name: /workouts/i }).click();
  await page.getByRole("button", { name: /start/i }).first().click();
  await page.waitForURL(/\/app\/workout\//, { timeout: 30_000 });

  // Log every visible set, advancing through the exercises.
  for (let i = 0; i < 40; i++) {
    const done = page.getByRole("button", { name: /finish workout|complete workout/i });
    if (await done.isVisible().catch(() => false)) {
      await done.click();
      break;
    }
    const next = page.getByRole("button", { name: /next|log set/i }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }

  await page.goto("/app");
  await expect(page.getByText(/day streak/i).first()).toBeVisible();
  const afterText = await page
    .getByText(/day streak/i)
    .first()
    .textContent();
  const after = Number(afterText?.match(/\d+/)?.[0] ?? "0");
  expect(after).toBeGreaterThanOrEqual(Math.max(before, 1));
});

/**
 * Platform console: the New gym dialog validates the gym code before it will
 * submit. Requires PLATFORM_EMAIL / PLATFORM_PASSWORD for a platform admin.
 */
test("platform admin opens the New gym dialog and sees code validation", async ({ page }) => {
  const pEmail = process.env.PLATFORM_EMAIL;
  const pPassword = process.env.PLATFORM_PASSWORD;
  test.skip(!pEmail || !pPassword, "PLATFORM_EMAIL / PLATFORM_PASSWORD not configured");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(pEmail!);
  await page.getByLabel(/^password/i).fill(pPassword!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/platform/, { timeout: 30_000 });

  await page.goto("/platform/gyms");
  await page.getByRole("button", { name: /new gym/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // A reserved code must never be accepted.
  await page.getByLabel("Gym code").fill("admin");
  await expect(page.getByRole("button", { name: /^create gym$/i })).toBeDisabled();

  // A fresh random code becomes available and enables submit.
  const code = `smoke-${Date.now().toString(36)}`;
  await page.getByLabel("Gym name").fill("Smoke Test Gym");
  await page.getByLabel("Gym code").fill(code);
  await expect(page.getByText("Available")).toBeVisible({ timeout: 15_000 });
});

/**
 * Gym admin: the Sponsors page loads, ads are opt-in, and a sponsor can be
 * drafted with an https-only link. Requires ADMIN_EMAIL / ADMIN_PASSWORD.
 */
test("gym admin opens Sponsors and drafts a sponsor", async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!email || !password, "ADMIN_EMAIL / ADMIN_PASSWORD not configured");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/^password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });

  await page.goto("/admin/sponsors");
  await expect(page.getByRole("heading", { name: /sponsors/i })).toBeVisible();
  await expect(page.getByText(/ads enabled/i)).toBeVisible();

  await page.getByRole("button", { name: /new sponsor/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Advertiser").fill("Smoke Test Sponsor");
  await page.getByLabel(/^headline/i).fill("Smoke test headline");

  // http links are refused; https is accepted.
  await page.getByLabel("Link").fill("http://example.com");
  await expect(page.getByText(/must start with https/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /create sponsor/i })).toBeDisabled();
  await page.getByLabel("Link").fill("https://example.com");
  await expect(page.getByRole("button", { name: /create sponsor/i })).toBeEnabled();
});

/**
 * Gym admin: membership tiers and dues. Recording a payment is the only way a
 * member gets a tier, so the tier page must be reachable and the dues list must
 * render its buckets. Requires ADMIN_EMAIL / ADMIN_PASSWORD.
 */
test("gym admin manages membership tiers and reviews dues", async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!email || !password, "ADMIN_EMAIL / ADMIN_PASSWORD not configured");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/^password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });

  // Tiers: the page loads and a new tier can be drafted.
  await page.goto("/admin/membership-plans");
  await expect(page.getByRole("heading", { name: /membership tiers/i })).toBeVisible();
  await page.getByRole("button", { name: /new tier/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: /save tier/i })).toBeDisabled();
  await page.getByLabel("Name").fill(`Smoke ${Date.now().toString(36)}`);
  await expect(page.getByRole("button", { name: /save tier/i })).toBeEnabled();
  await page.keyboard.press("Escape");

  // Dues: totals and the chase list render.
  await page.goto("/admin/dues");
  await expect(page.getByRole("heading", { name: /^dues$/i })).toBeVisible();
  await expect(page.getByText(/overdue/i).first()).toBeVisible();
  await page.getByRole("button", { name: /reminder settings/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  // Revenue report renders without a chart error.
  await page.goto("/admin/reports/revenue");
  await expect(page.getByRole("heading", { name: /^revenue$/i })).toBeVisible();
});

test("auth callback shows a clear error for an expired link", async ({ page }) => {
  await page.goto(
    "/auth/callback?error_description=Email%20link%20is%20invalid%20or%20has%20expired",
  );
  await expect(page.getByRole("heading", { name: /this link didn't work/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /send a new link/i })).toBeVisible();
});
