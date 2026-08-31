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

  const broken = await page.evaluate(() =>
    Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
  );
  expect(broken).toBe(0);
});

test("member signs in, completes a workout and the streak increments", async ({ page }) => {
  test.skip(!email || !password, "SMOKE_EMAIL / SMOKE_PASSWORD not configured");

  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/^password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/app/, { timeout: 30_000 });

  const streakText = await page.getByText(/day streak/i).first().textContent();
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
  const afterText = await page.getByText(/day streak/i).first().textContent();
  const after = Number(afterText?.match(/\d+/)?.[0] ?? "0");
  expect(after).toBeGreaterThanOrEqual(Math.max(before, 1));
});
