/**
 * Spec 006 · The quincena starts on the real payday (demo, EN/ES).
 * Nov 15 2026 is Sunday, so the salary arrives on Fri Nov 13: with the clock on that day the
 * Dashboard already shows the second half of November (Nov 13–29) with "paid early" and "payday
 * today", and Expenses' current quincena starts on the 13th (Nov 12 belongs to the previous one).
 */
import type { Page } from "@playwright/test";
import type { IsoDate, Locale } from "../../src/domain/types";
import { formatDate } from "../../src/i18n/format";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const localeOf = (metadata: unknown) => (metadata as { locale: Locale }).locale;
const settled = (page: Page) => expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
const short = (date: string, locale: Locale) => formatDate(date as IsoDate, locale, "short");

test.describe("US16 · quincena by the real payday (demo)", { tag: "@demo" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(Date.UTC(2026, 10, 13, 18)) }); // noon in CDMX
  });

  test("on Fri Nov 13 2026 the Dashboard already shows the new quincena", async ({
    page,
  }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    const m = MESSAGES[locale];
    await page.goto("/dashboard");
    await settled(page);

    const info = page.getByTestId("period-info");
    await expect(info).toContainText(short("2026-11-13", locale));
    await expect(info).toContainText(short("2026-11-29", locale));
    await expect(info).toContainText(m.dashboard.paydayToday);
    await expect(page.getByTestId("payday-moved-early")).toContainText(
      m.dashboard.paydayMovedEarly,
    );
    await expect(page.getByTestId("bucket-wants")).toBeVisible();
  });

  test("Expenses' current quincena starts on the payday", async ({ page }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    await page.goto("/expenses");
    await settled(page);

    const range = page.getByTestId("spending-period");
    await expect(range).toContainText(short("2026-11-13", locale));
    await expect(range).toContainText(short("2026-11-29", locale));
    await expect(page.getByTestId("spending-next")).toBeDisabled();
    // Nov 12 is the last day of the previous quincena (Oct 30 – Nov 12).
    await expect(page.getByText(formatDate("2026-11-12" as IsoDate, locale, "day"))).toHaveCount(0);

    await page.getByTestId("spending-previous").click();
    await expect(range).toContainText(short("2026-10-30", locale));
    await expect(range).toContainText(short("2026-11-12", locale));
  });
});
