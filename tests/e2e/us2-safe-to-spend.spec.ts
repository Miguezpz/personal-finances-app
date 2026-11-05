/**
 * T077 · US2 Safe-to-Spend end to end.
 *  - demo-*: the dashboard shows balances and a semáforo per bucket from the fictitious data; trying
 *    to record an expense shows the read-only toast and changes nothing.
 *  - live-*: recording an expense updates the balance and the color WITHOUT reloading (FR-018).
 * Locale-agnostic: driven by ids / test ids; amounts are formatted identically in en-US and es-MX.
 */
import { addDays } from "../../src/domain/dates";
import { periodOf, todayIn } from "../../src/domain/periods";
import { expect, test } from "./fixtures";

const TZ = "America/Mexico_City";

test.describe("US2 · Safe-to-Spend (demo)", { tag: "@demo" }, () => {
  test("shows both buckets with a semáforo; recording is read-only", async ({ page }) => {
    await page.goto("/dashboard");
    const needs = page.getByTestId("bucket-needs");
    const wants = page.getByTestId("bucket-wants");
    await expect(needs).toBeVisible();
    await expect(wants).toBeVisible();
    for (const card of [needs, wants]) {
      await expect(card).toHaveAttribute("data-light", /^(green|yellow|red)$/);
      await expect(card.locator(".money").first()).toContainText("$");
    }
    await expect(page.getByTestId("period-info")).toBeVisible();

    const before = await wants.innerText();
    await page.getByTestId("add-expense").click();
    await page.locator("#expense-amount").fill("500");
    const firstOption = await page
      .locator("#expense-subcategory option:not([value=''])")
      .first()
      .getAttribute("value");
    await page.locator("#expense-subcategory").selectOption(firstOption ?? "");
    await page.getByTestId("save-expense").click();

    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    // The optimistic change is rolled back: the card ends exactly as it started.
    await expect.poll(() => wants.innerText()).toBe(before);
  });
});

test.describe("US2 · Safe-to-Spend (live)", { tag: "@live" }, () => {
  test("an expense updates the balance and the color without reloading", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    // Seed as the owner: a 50/50 rule and a $20,000 income funding the CURRENT quincena.
    const today = todayIn(TZ, new Date());
    const period = periodOf(today);
    const received = addDays(period.start, -1);
    const { data: ruleId, error: ruleError } = await userClient.rpc("save_distribution_rule", {
      p_rule: { effective_from: received, needs_bps: 5000, wants_bps: 5000, investment_bps: 0 },
      p_subrules: [],
    });
    expect(ruleError).toBeNull();
    const { error: incomeError } = await userClient.rpc("register_income", {
      p_income: {
        label: "Salary",
        amount_cents: 2_000_000,
        received_on: received,
        funded_period_start: period.start,
        rule_id: ruleId,
      },
      p_allocations: [
        { bucket: "needs", amount_cents: 1_000_000, period_start: period.start },
        { bucket: "wants", amount_cents: 1_000_000, period_start: period.start },
      ],
    });
    expect(incomeError).toBeNull();

    // The default taxonomy is created by onboarding on first load.
    await page.goto("/dashboard");
    let restaurants: string | undefined;
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("subcategories")
          .select("id")
          .eq("user_id", owner.id)
          .eq("name", "Restaurants"); // Restaurants & Cafes › Restaurants (spec 004 default)
        restaurants = data?.[0]?.id;
        return restaurants;
      })
      .toBeTruthy();
    await page.reload(); // pick up the seeded income

    const wants = page.getByTestId("bucket-wants");
    await expect(wants).toHaveAttribute("data-light", "green");
    await expect(wants).toContainText("10,000.00");

    // Spend $9,000 of Wants: 10% left → red, with no reload.
    await page.getByTestId("add-expense").click();
    await page.locator("#expense-amount").fill("9,000");
    await page.locator("#expense-subcategory").selectOption(restaurants ?? "");
    await expect(page.getByTestId("expense-bucket")).toBeVisible();
    await page.getByTestId("save-expense").click();

    await expect(wants).toHaveAttribute("data-light", "red");
    await expect(wants.locator(".money").first()).toHaveText("$1,000.00");
    await expect(page.getByTestId("bucket-needs")).toHaveAttribute("data-light", "green");

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("expenses")
          .select("amount_cents, bucket")
          .eq("user_id", owner.id);
        return data;
      })
      .toEqual([{ amount_cents: 900_000, bucket: "wants" }]);
  });
});
