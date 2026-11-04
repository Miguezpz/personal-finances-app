/**
 * Spec 003 · US1 brand identity (all four projects): brand icons and manifest (FR-010, SC-010), the
 * brand mark instead of the generic wallet (FR-009), and at most one highlighted call to action per
 * screen on desktop (FR-006, SC-007).
 */
import type { Page } from "@playwright/test";
import { APP_ROUTES } from "./app-routes";
import { expect, test } from "./fixtures";

async function expectAtMostOneCta(page: Page, where: string) {
  await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
  const count = await page.locator('[data-variant="cta"]:visible').count();
  expect(count, `highlighted CTAs on ${where}`).toBeLessThanOrEqual(1);
}

test.describe("Brand identity", () => {
  test("declares the brand icons and a valid web manifest", async ({ page, request }) => {
    await page.goto("/");
    const head = page.locator("head");
    await expect(head.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(head.locator('link[rel="manifest"]')).toHaveCount(1);

    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as {
      name: string;
      short_name: string;
      theme_color: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest.name).toBe("Personal Finances");
    expect(manifest.theme_color).toBe("#0F766E");
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
    }
  });

  test("shows the brand mark in the header and on the landing page", async ({ page }, testInfo) => {
    const mode = testInfo.project.metadata.mode as "demo" | "live";
    if (mode === "demo") {
      // The demo has no landing: / goes straight to the dashboard.
      await page.goto("/dashboard");
      await expect(page.locator("header").getByTestId("brand-mark")).toBeVisible();
    } else {
      await page.goto("/");
      await expect(page.getByTestId("brand-mark")).toBeVisible();
      await expectAtMostOneCta(page, "/");
    }
  });
});

test.describe("Brand identity · one CTA per screen (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("demo: every route has at most one highlighted CTA", { tag: "@demo" }, async ({ page }) => {
    test.setTimeout(90_000);
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expectAtMostOneCta(page, route);
    }
  });

  test(
    "live: every route has at most one highlighted CTA",
    { tag: "@live" },
    async ({ ownerPage }) => {
      test.setTimeout(90_000);
      await expect(ownerPage.locator("header").getByTestId("brand-mark")).toBeVisible();
      for (const route of APP_ROUTES) {
        await ownerPage.goto(route);
        await expectAtMostOneCta(ownerPage, route);
      }
    },
  );
});
