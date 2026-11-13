/**
 * Spec 014 · Use Saved in goals.
 *  - demo (EN/ES): the Saved card shows "Available to assign"; Goals shows the sample purchase
 *    with its bar; Assign, Return and "I bought it" are refused as read-only; privacy masks them.
 *  - live: a previous quincena leaves $700 in Saved. Assign $500 to a new purchase from the Saved
 *    card (available drops to $200 without reloading), return $200, mark it bought, restore it.
 */
import type { Page } from "@playwright/test";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { addDays } from "../../src/domain/dates";
import { buildPayCalendar, periodOfDate } from "../../src/domain/pay-calendar";
import { todayIn } from "../../src/domain/periods";
import { DEFAULT_USER_SETTINGS } from "../../src/domain/settings";
import type { Locale } from "../../src/domain/types";
import { READABLE_AMOUNT } from "./app-routes";
import { currentQuincena, expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const TZ = "America/Mexico_City";
const localeOf = (metadata: unknown) => (metadata as { locale: Locale }).locale;
const settled = (page: Page) => expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
const readOnlyToast = (page: Page, locale: Locale) =>
  page.locator("[data-sonner-toast]").filter({ hasText: MESSAGES[locale].common.demoReadOnly });

test.describe("US18 · Assign Saved (demo)", { tag: "@demo" }, () => {
  test("shows what's available and the sample purchase, masked in privacy mode", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await settled(page);
    await expect(page.getByTestId("saved-available")).toContainText(READABLE_AMOUNT);

    await page.goto("/goals");
    await settled(page);
    const purchase = page.locator("[data-testid='goal-card'][data-kind='purchase']");
    await expect(purchase).toHaveCount(1);
    await expect(purchase.getByTestId("goal-progress-fill")).toBeVisible();
    await expect(purchase.getByTestId("goal-target-month")).toBeVisible();

    await page.getByTestId("privacy-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-privacy", "on");
    expect(READABLE_AMOUNT.exec(await purchase.innerText())).toBeNull();
    await page.getByTestId("privacy-toggle").click();
  });

  test("Assign, Return and I bought it are refused as read-only", async ({ page }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    await page.goto("/dashboard");
    await settled(page);
    await page.getByTestId("saved-assign").click();
    await page.getByTestId("saved-move-amount").fill("1");
    await page.getByTestId("saved-move-save").click();
    await expect(readOnlyToast(page, locale)).toBeVisible();

    await page.goto("/goals");
    await settled(page);
    const purchase = page.locator("[data-testid='goal-card'][data-kind='purchase']");
    await purchase.getByTestId("goal-return").click();
    await page.getByTestId("saved-move-amount").fill("1");
    await page.getByTestId("saved-move-save").click();
    await expect(readOnlyToast(page, locale)).toBeVisible();

    await purchase.getByTestId("goal-bought").click();
    await expect(readOnlyToast(page, locale).first()).toBeVisible();
    await expect(purchase.getByTestId("goal-completed")).toHaveCount(0);
  });
});

test.describe("US18 · Assign Saved (live)", { tag: "@live" }, () => {
  test("assign from the Saved card, return, I bought it and restore", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)];
    // Previous quincena: $1,000 to Wants and a $300 expense → $700 saved with the setting on.
    const current = currentQuincena(todayIn(TZ, new Date()));
    const previous = periodOfDate(
      addDays(current.from, -1),
      buildPayCalendar(DEFAULT_USER_SETTINGS, []),
    );
    const { data: ruleId, error: ruleError } = await userClient.rpc("save_distribution_rule", {
      p_rule: { effective_from: previous.from, needs_bps: 0, wants_bps: 10000, investment_bps: 0 },
      p_subrules: [],
    });
    expect(ruleError).toBeNull();
    const { error: incomeError } = await userClient.rpc("register_income", {
      p_income: {
        label: "Salary",
        amount_cents: 100_000,
        received_on: previous.from,
        funded_period_start: previous.start,
        rule_id: ruleId,
      },
      p_allocations: [{ bucket: "wants", amount_cents: 100_000, period_start: previous.start }],
    });
    expect(incomeError).toBeNull();

    await page.goto("/dashboard"); // onboarding creates the default taxonomy and settings
    let restaurants: string | undefined;
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("subcategories")
          .select("id")
          .eq("user_id", owner.id)
          .eq("name", "Restaurants");
        restaurants = data?.[0]?.id;
        return restaurants;
      })
      .toBeTruthy();
    const { error: expenseError } = await userClient.from("expenses").insert({
      amount_cents: 30_000,
      spent_on: previous.from,
      subcategory_id: restaurants as string,
      bucket: "wants",
    });
    expect(expenseError).toBeNull();
    const { error: settingsError } = await userClient
      .from("user_settings")
      .update({ save_surplus: true })
      .eq("user_id", owner.id);
    expect(settingsError).toBeNull();
    const { error: goalError } = await userClient.from("goals").insert({
      kind: "purchase",
      name: "Laptop",
      source_bucket: "investment",
      target_cents: 2_500_000,
    });
    expect(goalError).toBeNull();

    await page.reload();
    await settled(page);
    const available = page.getByTestId("saved-available");
    await expect(available).toContainText("700.00");

    // Assign $500 from the Saved card: the only goal comes chosen.
    await page.getByTestId("saved-assign").click();
    await page.getByTestId("saved-move-amount").fill("500");
    await page.getByTestId("saved-move-save").click();
    await expect(available).toContainText("200.00");

    // Goals by client navigation (no reload).
    await page.locator('a[href="/goals"]').first().click();
    await page.waitForURL("**/goals");
    const laptop = page.locator("[data-testid='goal-card'][data-kind='purchase']");
    await expect(laptop).toContainText("500.00");
    await expect(laptop.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");

    // Returning more than the goal holds is refused; $200 goes back.
    await laptop.getByTestId("goal-return").click();
    await page.getByTestId("saved-move-amount").fill("600");
    await page.getByTestId("saved-move-save").click();
    await expect(page.getByRole("dialog")).toContainText(m.goals.overMax.split("<max>")[0]!.trim());
    await page.getByTestId("saved-move-amount").fill("200");
    await page.getByTestId("saved-move-save").click();
    await expect(laptop).toContainText("300.00");
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("goal_saved_moves")
          .select("amount_cents")
          .eq("user_id", owner.id);
        return (data ?? []).reduce((s, m) => s + m.amount_cents, 0);
      })
      .toBe(30_000);

    // I bought it → completed; restore → active again with the same $300.
    await laptop.getByTestId("goal-bought").click();
    await expect(laptop.getByTestId("goal-completed")).toBeVisible();
    await expect(laptop.getByTestId("goal-return")).toHaveCount(0);
    await laptop.getByRole("button", { name: m.goals.restore }).click();
    await expect(laptop.getByTestId("goal-completed")).toHaveCount(0);
    await expect(laptop).toContainText("300.00");
  });
});
