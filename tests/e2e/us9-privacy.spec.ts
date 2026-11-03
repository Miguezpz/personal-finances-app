/**
 * T131 · US9 privacy mode (demo-en, demo-es): with privacy on, no route of the app shows a
 * readable amount — balances, tables, cards, chart axes and tooltips — and the choice survives a
 * reload. Masked amounts read "••••" (screen readers hear "Hidden amount").
 */
import { expect, test } from "./fixtures";
import { APP_ROUTES, READABLE_AMOUNT } from "./app-routes";

async function settledText(page: import("@playwright/test").Page): Promise<string> {
  await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  return page.locator("body").innerText();
}

test.describe("US9 · privacy mode", { tag: "@demo" }, () => {
  test("masks every amount on every route and persists across reloads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/dashboard");
    // Sanity check of the detector: amounts are readable before turning privacy on.
    expect(await settledText(page)).toMatch(READABLE_AMOUNT);

    const toggle = page.getByTestId("privacy-toggle");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-privacy", "on");

    for (const route of APP_ROUTES) {
      await page.goto(route);
      const text = await settledText(page);
      const leak = READABLE_AMOUNT.exec(text);
      expect(leak?.[0] ?? null, `readable amount on ${route}`).toBeNull();
      // Chart axes and tooltips are SVG/portal text: check them explicitly too.
      for (const t of await page
        .locator(".recharts-wrapper text, .recharts-tooltip-wrapper")
        .allTextContents()) {
        expect(t, `chart text on ${route}`).not.toMatch(READABLE_AMOUNT);
      }
      await expect(page.locator('.money[data-masked="false"]')).toHaveCount(0);
    }

    // The net-worth tooltip (only rendered on hover) is masked too.
    await page.goto("/net-worth");
    const surface = page.locator(".recharts-surface").first();
    await surface.hover({ position: { x: 200, y: 100 } });
    const tooltip = page.locator(".recharts-tooltip-wrapper");
    await expect(tooltip).toContainText("••••");
    expect(await tooltip.textContent()).not.toMatch(READABLE_AMOUNT);

    // Amount fields (prefilled when editing, or a suggested card payment) are hidden unless focused.
    await page.goto("/expenses");
    await page.getByTestId("pay-card").first().click();
    const amount = page.locator("#payment-amount");
    await amount.fill("1234.56");
    await expect(amount).toHaveCSS("filter", "none");
    await page.locator("#payment-note").focus();
    await expect(amount).toHaveCSS("filter", /blur/);
    await page.keyboard.press("Escape");

    await page.goto("/ledger");
    await expect(page.locator('.money[data-masked="true"]').first()).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-privacy", "on");
    await expect(page.getByTestId("privacy-toggle")).toHaveAttribute("aria-pressed", "true");
    expect(await settledText(page)).not.toMatch(READABLE_AMOUNT);

    // And back: amounts are readable again.
    await page.getByTestId("privacy-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-privacy", "off");
    expect(await settledText(page)).toMatch(READABLE_AMOUNT);
  });
});
