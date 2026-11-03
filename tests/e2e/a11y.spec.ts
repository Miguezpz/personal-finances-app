/**
 * T152 · Accessibility audit (demo-en, demo-es): axe-core on every route — and on the open
 * dialogs of the main flows — with no serious or critical violations (WCAG 2.1 A/AA rules).
 * Keyboard reachability of the main flow is covered by perf-budgets (SC-002).
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { APP_ROUTES } from "./app-routes";
import { expect, test } from "./fixtures";

async function audit(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The Next.js dev-tools badge is not part of the app.
    .exclude("nextjs-portal")
    .analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    );
  expect(serious, `axe on ${where}`).toEqual([]);
}

test.describe("Accessibility", { tag: "@demo" }, () => {
  test("every route has no serious or critical axe violations", async ({ page }) => {
    test.setTimeout(120_000);
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      await audit(page, route);
    }
  });

  test("main dialogs are accessible too", async ({ page }) => {
    test.setTimeout(60_000);
    for (const [route, open] of [
      ["/dashboard", "add-expense"],
      ["/income", "register-income"],
      ["/recurring", "add-recurring"],
      ["/goals", "add-goal"],
    ] as const) {
      await page.goto(route);
      await page.getByTestId(open).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, `${route} dialog`);
    }
  });

  test("keyboard: the first Tab offers to skip to the content, which then gets focus", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("bucket-needs")).toBeVisible();
    await page.waitForLoadState("networkidle");
    // `next dev` only: its dev-tools badge can take focus; it isn't part of the app (absent in
    // the production build CI tests).
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    await page.keyboard.press("Tab");
    const skip = page.getByTestId("skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
    // The next Tab lands inside the page content, not back in the header.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("main") !== null)).toBe(true);
  });
});
