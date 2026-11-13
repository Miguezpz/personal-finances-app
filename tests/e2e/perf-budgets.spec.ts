/**
 * T166 · Perceived-performance budgets (demo-* and live-*):
 *   SC-002  record an expense with the keyboard in < 20 s
 *   SC-003  dashboard balances visible < 5 s after loading
 *   SC-004  balance updated < 1 s after saving (live: the demo doesn't save)
 *   SC-010  language switch < 1 s
 * Each page is visited once first: the dev server compiles a route on its first request, which is
 * not what the budgets measure (CI runs the production build).
 */
import type { Page, TestInfo } from "@playwright/test";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { todayIn } from "../../src/domain/periods";
import type { Locale } from "../../src/domain/types";
import { currentQuincena, expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const localeOf = (testInfo: TestInfo) => (testInfo.project.metadata as { locale: Locale }).locale;

async function timed(action: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await action();
  return Date.now() - start;
}

async function dashboardBudget(page: Page) {
  await page.goto("/dashboard"); // warm-up
  await expect(page.getByTestId("bucket-needs")).toBeVisible();
  const ms = await timed(async () => {
    await page.reload();
    await expect(page.getByTestId("bucket-needs").locator(".money").first()).toBeVisible();
  });
  expect(ms, "SC-003 dashboard balances").toBeLessThan(5_000);
}

/** Opens the dialog and fills it with the keyboard only; returns when the save was submitted. */
async function recordExpenseWithKeyboard(page: Page, amount: string) {
  // The N shortcut opens the expense dialog (spec 008, FR-011).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#expense-amount").focus();
  await page.keyboard.type(amount);
  // Type-ahead on the native select: the first letters of an option pick it.
  const option = (await page
    .locator("#expense-subcategory option:not([value=''])")
    .first()
    .textContent()) as string;
  await page.locator("#expense-subcategory").focus();
  await page.keyboard.type(option.slice(0, 4));
  await expect(page.locator("#expense-subcategory")).not.toHaveValue("");
  await page.locator("#expense-amount").focus();
  await page.keyboard.press("Enter");
}

async function languageBudget(page: Page, locale: Locale) {
  const other: Locale = locale === "en" ? "es" : "en";
  const ms = await timed(async () => {
    await page.getByTestId("language-toggle").locator(`button[lang="${other}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      MESSAGES[other].dashboard.title,
    );
  });
  expect(ms, "SC-010 language switch").toBeLessThan(1_000);
}

test.describe("Performance budgets", () => {
  test("demo", { tag: "@demo" }, async ({ page }, testInfo) => {
    const locale = localeOf(testInfo);
    await dashboardBudget(page);

    const ms = await timed(async () => {
      await recordExpenseWithKeyboard(page, "250");
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible(); // read-only notice
    });
    expect(ms, "SC-002 expense with the keyboard").toBeLessThan(20_000);

    await page.goto("/dashboard");
    await expect(page.getByTestId("bucket-needs")).toBeVisible();
    await languageBudget(page, locale);
  });

  test(
    "live",
    { tag: "@live" },
    async ({ ownerPage: page, userClient, admin, owner }, testInfo) => {
      const locale = localeOf(testInfo);
      const period = currentQuincena(todayIn("America/Mexico_City", new Date()));
      const { data: ruleId } = await userClient.rpc("save_distribution_rule", {
        p_rule: {
          effective_from: period.from,
          needs_bps: 5000,
          wants_bps: 5000,
          investment_bps: 0,
        },
        p_subrules: [],
      });
      await userClient.rpc("register_income", {
        p_income: {
          label: "Salary",
          amount_cents: 200_000,
          received_on: period.from,
          funded_period_start: period.start,
          rule_id: ruleId,
        },
        p_allocations: [
          { bucket: "needs", amount_cents: 100_000, period_start: period.start },
          { bucket: "wants", amount_cents: 100_000, period_start: period.start },
        ],
      });
      await expect
        .poll(async () => {
          const { count } = await admin
            .from("subcategories")
            .select("id", { count: "exact", head: true })
            .eq("user_id", owner.id);
          return count ?? 0;
        })
        .toBeGreaterThan(0);

      await dashboardBudget(page);

      const balance = async () =>
        Promise.all(
          ["needs", "wants"].map((b) =>
            page.getByTestId(`bucket-${b}`).locator(".money").first().innerText(),
          ),
        ).then((xs) => xs.join("|"));
      const before = await balance();
      let afterSave = 0;
      const ms = await timed(async () => {
        await recordExpenseWithKeyboard(page, "250");
        const saved = Date.now();
        await expect.poll(balance, { timeout: 5_000 }).not.toBe(before);
        afterSave = Date.now() - saved;
      });
      expect(ms, "SC-002 expense with the keyboard").toBeLessThan(20_000);
      expect(afterSave, "SC-004 balance after saving").toBeLessThan(1_000);

      await languageBudget(page, locale);
    },
  );
});
