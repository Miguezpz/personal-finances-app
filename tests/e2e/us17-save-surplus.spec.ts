/**
 * Spec 013 · The leftover of each quincena goes to Saved instead of carrying.
 *  - demo (EN/ES): the Saved card shows both amounts and hides them in privacy mode; switching
 *    the setting in Preferences is refused as read-only.
 *  - live: a previous quincena with $700 left in Wants. Turning the setting on moves it to Saved
 *    and Wants' carry drops to $0 without reloading; turning it off hides the card again.
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

test.describe("US17 · Saved (demo)", { tag: "@demo" }, () => {
  test("the Saved card shows both amounts and masks them in privacy mode", async ({ page }) => {
    await page.goto("/dashboard");
    await settled(page);
    const card = page.getByTestId("saved-card");
    await expect(card.getByTestId("saved-last")).toContainText(READABLE_AMOUNT);
    await expect(card.getByTestId("saved-total")).toContainText(READABLE_AMOUNT);

    await page.getByTestId("privacy-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-privacy", "on");
    expect(READABLE_AMOUNT.exec(await card.innerText())).toBeNull();
    await page.getByTestId("privacy-toggle").click();
  });

  test("switching the setting is refused as read-only", async ({ page }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    await page.goto("/settings/preferences");
    await settled(page);
    const toggle = page.getByTestId("pref-save-surplus");
    await expect(toggle).toBeChecked();
    await toggle.click();
    await page.getByTestId("save-preferences").click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: MESSAGES[locale].common.demoReadOnly }),
    ).toBeVisible();
  });
});

test.describe("US17 · Saved (live)", { tag: "@live" }, () => {
  test("turning it on moves the leftover to Saved without reloading", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    // Seed the PREVIOUS quincena: $1,000 to Wants and a $300 expense inside its range.
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

    await page.goto("/dashboard"); // onboarding creates the default taxonomy
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

    await page.reload();
    const wantsBalance = page.getByTestId("bucket-wants-balance");
    await expect(wantsBalance).toContainText("700.00"); // off: the leftover carries
    await expect(page.getByTestId("saved-card")).toHaveCount(0);

    // On: save in Preferences, then back to the Dashboard by client navigation (no reload).
    const toggleAndSave = async (checked: boolean) => {
      await page.goto("/settings/preferences");
      await settled(page);
      await page.getByTestId("pref-save-surplus").click();
      await page.getByTestId("save-preferences").click();
      await expect
        .poll(async () => {
          const { data } = await admin
            .from("user_settings")
            .select("save_surplus")
            .eq("user_id", owner.id);
          return data?.[0]?.save_surplus;
        })
        .toBe(checked);
      await page.locator('a[href="/dashboard"]').first().click();
      await page.waitForURL("**/dashboard");
    };

    await toggleAndSave(true);
    await expect(page.getByTestId("saved-last")).toContainText("700.00");
    await expect(wantsBalance).not.toContainText("700.00");
    await expect(wantsBalance).toContainText("0.00");

    // Off again: the card goes away and the leftover carries.
    await toggleAndSave(false);
    await expect(page.getByTestId("saved-card")).toHaveCount(0);
    await expect(wantsBalance).toContainText("700.00");
  });
});
