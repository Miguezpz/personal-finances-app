/**
 * US4 · spending by payment method (demo-en, demo-es): the Expenses page shows the current
 * quincena's spending with cash and every credit card, the rows add up to the total, and ‹ ›
 * move between quincenas (› stops at the current one).
 */
import type { Locator } from "@playwright/test";
import { ACCOUNT_IDS } from "../../src/data/mock/fixtures/catalog";
import { previousPeriod, todayIn } from "../../src/domain/periods";
import { currentQuincena, expect, test } from "./fixtures";

const TZ = "America/Mexico_City";
const centsOf = async (l: Locator) => Number((await l.textContent())?.replace(/\D/g, "") ?? "0");

test.describe("US4 · spending by payment method", { tag: "@demo" }, () => {
  test("shows cash and cards for the quincena, adds up, and navigates", async ({ page }) => {
    const current = currentQuincena(todayIn(TZ, new Date())); // by the real payday (spec 006)
    await page.goto("/expenses");

    const section = page.getByTestId("spending-by-method");
    await expect(section).toHaveAttribute("data-period", current.key);
    const rows = section.getByTestId("spending-row");
    for (const id of [ACCOUNT_IDS.cash, ACCOUNT_IDS.goldCard, ACCOUNT_IDS.travelCard]) {
      await expect(
        section.locator(`[data-testid="spending-row"][data-account="${id}"]`),
      ).toHaveCount(1);
    }

    const total = section.getByTestId("spending-total").locator("dd");
    const amounts = await Promise.all((await rows.locator("dd").all()).map(centsOf));
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(await centsOf(total));

    const next = page.getByTestId("spending-next");
    await expect(next).toBeDisabled();
    await page.getByTestId("spending-previous").click();
    await expect(section).toHaveAttribute("data-period", previousPeriod(current).key);
    await expect(next).toBeEnabled();
    await next.click();
    await expect(section).toHaveAttribute("data-period", current.key);
  });
});
