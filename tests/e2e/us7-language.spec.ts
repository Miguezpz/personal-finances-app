/**
 * T118 · US7 EN/ES (demo-en, demo-es).
 *  - Switching language changes every text in place: no reload, half-filled forms keep their
 *    content — also when the display currency changes with the form open (FR-039, SC-010).
 *  - The choice persists across reloads (US7-3).
 *  - A first visit with no preferences is in English (US7-1); the NEXT_LOCALE cookie decides the
 *    language before the first paint.
 */
import type { Locale } from "../../src/domain/types";
import { expect, test } from "./fixtures";

const RULES_TITLE: Record<Locale, string> = {
  en: "Distribution rules",
  es: "Reglas de distribución",
};
const NAV_DASHBOARD: Record<Locale, string> = { en: "Dashboard", es: "Inicio" };

test.describe("US7 · language", { tag: "@demo" }, () => {
  test("switches in place, keeps a half-filled form, and persists", async ({ page }, testInfo) => {
    const start = (testInfo.project.metadata as { locale: Locale }).locale;
    const other: Locale = start === "en" ? "es" : "en";

    await page.goto("/settings/rules");
    await expect(page.locator("html")).toHaveAttribute("lang", start);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(RULES_TITLE[start]);

    // A marker that only survives if the page is NOT reloaded.
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });
    await page.locator("#rule-needs").fill("61");

    await page.getByTestId("language-toggle").locator(`button[lang="${other}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(RULES_TITLE[other]);
    await expect(page.locator("html")).toHaveAttribute("lang", other);
    await expect(page.getByRole("navigation").first()).toContainText(NAV_DASHBOARD[other]);
    await expect(page.locator("#rule-needs")).toHaveValue("61");
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true);

    // Changing the display currency with the form open doesn't lose it either.
    await page.getByTestId("currency-toggle").getByRole("button", { name: "USD" }).click();
    await expect(page.locator("#rule-needs")).toHaveValue("61");

    // Persists across a reload, and the cookie follows the choice.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(RULES_TITLE[other]);
    await expect(page.locator("html")).toHaveAttribute("lang", other);
    const cookie = (await page.context().cookies()).find((c) => c.name === "NEXT_LOCALE");
    expect(cookie?.value).toBe(other);
  });

  test("a first visit with no preferences is in English", async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL ?? "",
      // Playwright applies the project options (incl. its NEXT_LOCALE cookie) to manual contexts.
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("navigation").first()).toContainText("Dashboard");
    await context.close();
  });

  test("the NEXT_LOCALE cookie sets the language before the first paint", async ({
    browser,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? "";
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    await context.addCookies([{ name: "NEXT_LOCALE", value: "es", url: baseURL }]);
    const page = await context.newPage();
    // Right after parsing (before React hydrates), the inline script has already applied it.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("es");
    await expect(page.getByRole("navigation").first()).toContainText("Inicio");
    await expect(page).toHaveTitle("Finanzas Personales");
    await context.close();
  });
});
