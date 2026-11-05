/**
 * T130 · US9 public demo (demo-en, demo-es): entering goes straight to the dashboard, a persistent
 * banner says it's read-only, every create / edit / delete shows the read-only toast and changes
 * nothing, and the browser never talks to Supabase.
 */
import type { Page } from "@playwright/test";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import type { Locale } from "../../src/domain/types";
import { expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const SUPABASE = /\.supabase\.(co|in|net)|:54321\b/;

async function expectReadOnly(page: Page, locale: Locale) {
  const toasts = page.locator("[data-sonner-toast]");
  await expect(toasts.filter({ hasText: MESSAGES[locale].common.demoReadOnly })).toHaveCount(1);
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
}

test.describe("US9 · read-only demo", { tag: "@demo" }, () => {
  test("enters without sign-in, refuses every write and never calls Supabase", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const locale = (testInfo.project.metadata as { locale: Locale }).locale;
    const supabaseCalls: string[] = [];
    page.on("request", (r) => {
      if (SUPABASE.test(r.url())) supabaseCalls.push(r.url());
    });

    // Entry: the demo has no sign-in; the landing goes straight to the dashboard.
    await page.goto("/");
    await page.waitForURL("**/dashboard");
    const banner = page.getByTestId("demo-banner");
    await expect(banner).toContainText(MESSAGES[locale].demo.banner);
    await expect(banner.getByRole("link")).toHaveAttribute(
      "href",
      "https://github.com/Miguezpz/personal-finances-app",
    );

    await page.goto("/ledger");
    const ledgerCount = page.getByTestId("ledger-count");
    await expect(ledgerCount).toBeVisible();
    const before = await ledgerCount.innerText();

    // --- Create: income, expense, card payment, collection, account, category -------------
    await page.goto("/income");
    await expect(page.getByTestId("income-card").first()).toBeVisible();
    const incomes = await page.getByTestId("income-card").count();
    await page.getByTestId("register-income").click();
    // The income type is mandatory (spec 004).
    await page.getByTestId("income-type-extra").click();
    await page.locator("#income-label").fill("Bonus");
    await page.locator("#income-amount").fill("1000");
    await page.getByTestId("save-income").click();
    await expectReadOnly(page, locale);
    await expect(page.getByTestId("income-card")).toHaveCount(incomes);

    await page.goto("/expenses");
    await page.getByTestId("add-expense").click();
    await page.locator("#expense-amount").fill("250");
    await page.locator("#expense-subcategory").selectOption({ index: 1 });
    await page.getByTestId("save-expense").click();
    await expectReadOnly(page, locale);

    await page.goto("/expenses");
    await page.getByTestId("pay-card").first().click();
    await page.locator("#payment-amount").fill("100");
    await page.getByTestId("save-card-payment").click();
    await expectReadOnly(page, locale);

    await page.goto("/receivables");
    await page.getByTestId("record-collection").first().click();
    // Defaults to "collected in full".
    await page.getByTestId("save-collection").click();
    await expectReadOnly(page, locale);

    await page.goto("/settings/accounts");
    await expect(page.getByTestId("account-card").first()).toBeVisible();
    const accounts = await page.getByTestId("account-card").count();
    await page.getByTestId("add-account").click();
    await page.locator("#account-name").fill("Demo savings");
    await page.getByTestId("save-account").click();
    await expectReadOnly(page, locale);
    await expect(page.getByTestId("account-card")).toHaveCount(accounts);

    await page.goto("/settings/categories");
    await expect(page.getByTestId("category-card").first()).toBeVisible();
    const categories = await page.getByTestId("category-card").count();
    await page.getByTestId("add-category").click();
    // A name that is not already a default category (spec 004 added "Pets").
    await page.locator("#taxonomy-name").fill("Garden");
    await page.getByTestId("save-taxonomy").click();
    await expectReadOnly(page, locale);
    await expect(page.getByTestId("category-card")).toHaveCount(categories);

    // --- Edit: pause a recurring expense, preferences, distribution rule -------------------
    await page.goto("/recurring");
    const first = page.getByTestId("recurring-card").first();
    const status = await first.getAttribute("data-status");
    await page.getByTestId("toggle-recurring").first().click();
    await expectReadOnly(page, locale);
    await expect(first).toHaveAttribute("data-status", status as string);

    await page.goto("/settings/preferences");
    const lead = page.locator("#pref-lead");
    const leadBefore = await lead.inputValue();
    await lead.fill(leadBefore === "5" ? "6" : "5");
    await page.getByTestId("save-preferences").click();
    await expectReadOnly(page, locale);
    await expect(lead).toHaveValue(leadBefore);

    await page.goto("/settings/rules");
    await page.getByTestId("save-rule").click();
    await expectReadOnly(page, locale);

    // --- Delete / archive: an account ------------------------------------------------------
    await page.goto("/settings/accounts");
    const card = page.getByTestId("account-card").first();
    await card.getByTestId("archive-account").click();
    await expectReadOnly(page, locale);
    await expect(card).toHaveAttribute("data-archived", "false");

    // Nothing changed, and nothing ever went to Supabase.
    await page.goto("/ledger");
    await expect(ledgerCount).toHaveText(before);
    expect(supabaseCalls).toEqual([]);
  });
});
