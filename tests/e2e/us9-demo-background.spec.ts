/**
 * T163 · US9 demo background processes (demo-en, demo-es): just opening each route of the app
 * must not attempt any write (onboarding, recurring materialisation… all check capabilities), so
 * no toast and no error appears. Only user actions produce the read-only toast (us9-demo.spec).
 */
import { expect, test } from "./fixtures";
import { APP_ROUTES } from "./app-routes";

test.describe("US9 · demo without background writes", { tag: "@demo" }, () => {
  test("loading every route shows no toast and no error", async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      await page.waitForLoadState("networkidle");
      // Give background effects (onboarding, materialisation, FX) time to act if they would.
      await page.waitForTimeout(1_000);
      await expect(page.locator("[data-sonner-toast]"), `toast on ${route}`).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
});
