/**
 * T112 · US6 multi-currency display (demo-en, demo-es). The exchange-rate APIs are intercepted so
 * the test is deterministic and never depends on the real sources.
 *  - USD/EUR amounts = MXN × rate (presentation only); the rate and its date are shown (FR-035).
 *  - Back to MXN, every amount is EXACTLY the original (SC-008).
 *  - The choice persists across reloads (US6-4).
 *  - With both sources down the warning shows in under 10 s and amounts stay in MXN (SC-009).
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const FRANKFURTER = "**/api.frankfurter.dev/**";
const ER_API = "**/open.er-api.com/**";

async function serveRates(page: Page, usd: number, eur: number) {
  await page.route(FRANKFURTER, (route) =>
    route.fulfill({
      json: { amount: 1, base: "MXN", date: "2026-11-02", rates: { USD: usd, EUR: eur } },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route(ER_API, (route) => route.abort());
}

/** "$1,234.56", "-$21.00", "€1,234.56", "$1,234.56 USD" → 1234.56 (both en-US and es-MX use "." decimals). */
const amountOf = (text: string) => Number(text.replace(/[^\d.-]/g, ""));

test.describe("US6 · display currency", { tag: "@demo" }, () => {
  test("converts for display, shows the rate, restores MXN exactly and persists", async ({
    page,
  }) => {
    await serveRates(page, 0.05, 0.04);
    await page.goto("/dashboard");
    const wants = page.getByTestId("bucket-wants").locator(".money").first();
    await expect(wants).toHaveAttribute("data-currency", "MXN");
    const mxnText = await wants.innerText();
    const mxn = amountOf(mxnText);

    const toggle = page.getByTestId("currency-toggle");
    await toggle.getByRole("button", { name: "USD" }).click();
    const status = page.getByTestId("fx-status");
    await expect(status).toHaveAttribute("data-state", "ok");
    await expect(status).toContainText("1 USD = 20");
    await expect(wants).toHaveAttribute("data-currency", "USD");
    await expect(wants).toContainText("USD");
    expect(amountOf(await wants.innerText())).toBeCloseTo(mxn * 0.05, 2);

    await toggle.getByRole("button", { name: "EUR" }).click();
    await expect(wants).toHaveAttribute("data-currency", "EUR");
    await expect(wants).toContainText("€");
    expect(amountOf(await wants.innerText())).toBeCloseTo(mxn * 0.04, 2);

    await toggle.getByRole("button", { name: "MXN" }).click();
    await expect(wants).toHaveText(mxnText);
    await expect(status).toHaveCount(0);

    // The preference survives a reload.
    await toggle.getByRole("button", { name: "USD" }).click();
    await page.reload();
    await expect(
      page.getByTestId("currency-toggle").getByRole("button", { name: "USD" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("bucket-wants").locator(".money").first()).toHaveAttribute(
      "data-currency",
      "USD",
    );
  });

  test("with every source down, warns quickly and keeps amounts in MXN", async ({ page }) => {
    await page.route(FRANKFURTER, (route) => route.abort());
    await page.route(ER_API, (route) => route.abort());
    await page.goto("/dashboard");
    const wants = page.getByTestId("bucket-wants").locator(".money").first();
    await expect(wants).toBeVisible();

    const started = Date.now();
    await page.getByTestId("currency-toggle").getByRole("button", { name: "USD" }).click();
    await expect(page.getByTestId("fx-status")).toHaveAttribute("data-state", "unavailable", {
      timeout: 10_000,
    });
    expect(Date.now() - started).toBeLessThan(10_000);
    await expect(wants).toHaveAttribute("data-currency", "MXN");
    await expect(page.getByTestId("fx-retry")).toBeVisible();

    // Back online: retrying brings the conversion.
    await page.unroute(FRANKFURTER);
    await serveRates(page, 0.05, 0.04);
    await page.getByTestId("fx-retry").click();
    await expect(page.getByTestId("fx-status")).toHaveAttribute("data-state", "ok");
    await expect(wants).toHaveAttribute("data-currency", "USD");
  });
});
