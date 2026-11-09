/**
 * Spec 009 · low-friction flows.
 *  - demo-en, demo-es: the expense form (date chips, recent subcategories, decimal comma, save and
 *    add another), delete without a confirmation (refused read-only, the row stays), rows that open
 *    their edit dialog on a phone, day groups, Expenses filters in the URL, Ledger presets and
 *    search in the URL, rows that open their edit dialog, the Dashboard's bucket link, installment
 *    cards and Settings › Quick expenses.
 *  - live-en, live-es (not run locally by the owner's decision for UI-only work): the remembered
 *    account and subcategory, and Undo after deleting.
 */
import type { Page } from "@playwright/test";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import type { Locale } from "../../src/domain/types";
import { expect, openCreate, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const localeOf = (metadata: unknown) => (metadata as { locale: Locale }).locale;
const PHONE = { width: 390, height: 844 };

const readOnlyToast = (page: Page, locale: Locale) =>
  page.locator("[data-sonner-toast]").filter({ hasText: MESSAGES[locale].common.demoReadOnly });

async function settled(page: Page) {
  await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
}

test.describe("Spec 009 · flows in the demo", { tag: "@demo" }, () => {
  test("the expense form: date chips, recent subcategories, decimal comma, save and add", async ({
    page,
  }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    await page.goto("/dashboard");
    await settled(page);
    const dialog = await openCreate(page, "expense");

    await expect(dialog.getByTestId("date-chip-today")).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.locator("#expense-date")).toHaveCount(0);
    await dialog.getByTestId("date-chip-other").click();
    const date = dialog.locator("#expense-date");
    await expect(date).toBeVisible();
    const max = await date.getAttribute("max");
    expect(max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await dialog.getByTestId("date-chip-yesterday").click();
    await expect(date).toHaveCount(0);

    // The demo has history: recent subcategories are one-tap chips.
    const recent = dialog.getByTestId("recent-subcategory");
    await expect(recent.first()).toBeVisible();
    expect(await recent.count()).toBeLessThanOrEqual(6);
    await recent.first().click();
    await expect(recent.first()).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.locator("#expense-subcategory")).not.toHaveValue("");

    // "250,5" is a valid amount: saving reaches the (read-only) provider, not a field error.
    await dialog.locator("#expense-amount").fill("250,5");
    await expect(dialog.getByTestId("save-and-add")).toBeVisible();
    await dialog.getByTestId("save-expense").click();
    await expect(readOnlyToast(page, locale).first()).toBeVisible();
  });

  test("deleting an expense needs no confirmation; the demo refuses it and the row stays", async ({
    page,
  }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    await page.goto("/expenses");
    await settled(page);
    const rows = page.getByTestId("expense-row");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    await rows.first().hover();
    await rows.first().getByTestId("row-delete").click();
    await expect(readOnlyToast(page, locale).first()).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(rows).toHaveCount(count);
  });

  test("Expenses: chips filter the list and live in the URL", async ({ page }) => {
    await page.goto("/expenses");
    await settled(page);
    await page.getByTestId("filter-bucket-wants").click();
    await expect(page).toHaveURL(/bucket=wants/);
    await expect(page.getByTestId("filter-bucket-wants")).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByTestId("filter-bucket-wants")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("clear-filters").click();
    await expect(page).not.toHaveURL(/bucket=/);
  });

  test("the Dashboard's bucket link opens Expenses filtered", async ({ page }) => {
    await page.goto("/dashboard");
    await settled(page);
    await page.getByTestId("bucket-needs-link").click();
    await page.waitForURL(/\/expenses\?bucket=needs/);
    await expect(page.getByTestId("filter-bucket-needs")).toHaveAttribute("aria-pressed", "true");
  });

  test("Ledger: a preset and a search live in the URL; a row opens its edit dialog", async ({
    page,
  }) => {
    await page.goto("/ledger");
    await settled(page);
    await page.getByTestId("ledger-preset-last-month").click();
    await expect(page).toHaveURL(/preset=last-month/);
    await page.getByTestId("ledger-search").fill("zzz-nothing");
    await expect(page).toHaveURL(/q=zzz-nothing/);
    await page.reload();
    await expect(page.getByTestId("ledger-search")).toHaveValue("zzz-nothing");
    await expect(page.getByTestId("ledger-preset-last-month")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByTestId("ledger-search").fill("");
    await page.getByTestId("ledger-preset-last-month").click();
    await expect(page).not.toHaveURL(/preset=/);

    const open = page.getByTestId("ledger-open").first();
    await expect(open).toBeVisible();
    await open.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("＋ sheet's Manage goes to Settings › Quick expenses", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/dashboard");
    await settled(page);
    await page.getByTestId("mobile-nav-create").click();
    await page.getByTestId("create-manage-quick").click();
    await page.waitForURL("**/settings/quick-expenses");
    await expect(page.getByTestId("quick-expenses-section")).toBeVisible();
    await expect(page.getByTestId("page-back")).toBeVisible();
  });
});

test.describe("Spec 009 · lists on a phone", { tag: "@demo" }, () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("an expense row opens its edit dialog with Delete; rows are grouped by day", async ({
    page,
  }) => {
    await page.goto("/expenses");
    await settled(page);
    await expect(page.getByTestId("day-group").first()).toBeVisible();
    await expect(page.getByTestId("expense-row").first().getByTestId("row-delete")).toBeHidden();
    await expect(page.getByTestId("save-and-add")).toHaveCount(0);
    await page.getByTestId("expense-row-open").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("delete-expense")).toBeVisible();
    await expect(dialog.getByTestId("save-and-add")).toHaveCount(0);
  });

  test("new chips and row buttons are at least 44 px tall (FR-032)", async ({ page }) => {
    await page.goto("/expenses");
    await settled(page);
    const targets = page.locator(
      '[data-testid="expense-filters"] [data-slot="chip"], [data-testid="expense-row-open"]',
    );
    await expect(page.getByTestId("expense-row-open").first()).toBeVisible();
    const count = await targets.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < Math.min(count, 8); i++) {
      // Poll and round: rows can still be animating in (sub-pixel heights).
      await expect
        .poll(async () => Math.round((await targets.nth(i).boundingBox())?.height ?? 0), {
          message: `height of target ${i}`,
        })
        .toBeGreaterThanOrEqual(44);
    }
  });

  test("installments are cards, with no horizontal scroll", async ({ page }) => {
    await page.goto("/receivables");
    await settled(page);
    await expect(page.getByTestId("installment-card").first()).toBeVisible();
    await expect(page.getByTestId("installment-row").first()).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("Spec 009 · flows that write", { tag: "@live" }, () => {
  test("the next expense prefills the last account and subcategory; delete has Undo", async ({
    ownerPage: page,
    userClient,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)];
    const { data: account } = await userClient
      .from("accounts")
      .insert({ kind: "cash", name: "Wallet" })
      .select("id")
      .single();
    await page.goto("/expenses");
    await settled(page);

    let dialog = await openCreate(page, "expense");
    await dialog.locator("#expense-amount").fill("120");
    await dialog.locator("#expense-subcategory").selectOption({ index: 1 });
    const subcategory = await dialog.locator("#expense-subcategory").inputValue();
    await dialog.locator("#expense-account").selectOption(account?.id as string);
    await dialog.getByTestId("save-expense").click();
    await expect(page.getByTestId("expense-row")).toHaveCount(1);

    dialog = await openCreate(page, "expense");
    await expect(dialog.locator("#expense-subcategory")).toHaveValue(subcategory);
    await expect(dialog.locator("#expense-account")).toHaveValue(account?.id as string);
    await page.keyboard.press("Escape");

    // Delete → gone at once → Undo brings it back.
    const row = page.getByTestId("expense-row").first();
    await row.hover();
    await row.getByTestId("row-delete").click();
    await expect(page.getByTestId("expense-row")).toHaveCount(0);
    await page.locator("[data-sonner-toast]").getByRole("button", { name: m.common.undo }).click();
    await expect(page.getByTestId("expense-row")).toHaveCount(1);
  });
});
