/**
 * T067 · US1 end to end (live-en + live-es): configure 50/30/20 with 90/10 vehicles, reject
 * 50/30/30, register $20,000 received on a 15th and verify the split 10,000 / 6,000 / 3,600 / 400
 * funding the 16th–end quincena, both in the UI and in the database.
 * Locale-agnostic: it drives the UI by ids/test ids and asserts persisted data via `admin`.
 */
import { expect, nextFifteenth, openCreate, test } from "./fixtures";

test.describe("US1 · automatic income split", { tag: "@live" }, () => {
  test("rules are validated, and a $20,000 income is split exactly", async ({
    ownerPage: page,
    admin,
    owner,
  }) => {
    // --- Rules: 50/30/30 is rejected -----------------------------------------------------
    await page.goto("/settings/rules");
    await page.locator("#rule-needs").fill("50");
    await page.locator("#rule-wants").fill("30");
    await page.locator("#rule-investment").fill("30");
    await expect(page.getByRole("status").filter({ hasText: "10%" })).toBeVisible();

    // --- Two investment vehicles, 90/10 -------------------------------------------------
    await page.locator("#new-vehicle").fill("Stocks");
    await page.getByTestId("create-vehicle").click();
    await expect(page.locator("#subrule-0-account")).not.toHaveValue("");
    await page.locator("#new-vehicle").fill("Sofipos");
    await page.getByTestId("create-vehicle").click();
    await expect(page.locator("#subrule-1-account")).not.toHaveValue("");
    await page.locator("#subrule-0-pct").fill("90");
    await page.locator("#subrule-1-pct").fill("10");

    await page.getByTestId("save-rule").click();
    // Still 130%: nothing may be persisted.
    await page.waitForTimeout(500);
    const { count: rulesAfterInvalid } = await admin
      .from("distribution_rules")
      .select("*", { count: "exact", head: true })
      .eq("user_id", owner.id);
    expect(rulesAfterInvalid).toBe(0);

    // --- Fix to 50/30/20 and save --------------------------------------------------------
    await page.locator("#rule-investment").fill("20");
    await expect(page.getByRole("status").filter({ hasText: "100%" })).toBeVisible();
    await page.getByTestId("save-rule").click();
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("distribution_rules")
          .select("needs_bps, wants_bps, investment_bps, investment_subrules(pct_bps)")
          .eq("user_id", owner.id);
        return data;
      })
      .toEqual([
        {
          needs_bps: 5000,
          wants_bps: 3000,
          investment_bps: 2000,
          investment_subrules: expect.arrayContaining([{ pct_bps: 9000 }, { pct_bps: 1000 }]),
        },
      ]);

    // --- Register $20,000 received on the 15th -------------------------------------------
    const { received, fundedStart } = nextFifteenth();
    await page.goto("/income");
    await openCreate(page, "income");
    // The income type is mandatory (spec 004).
    await page.getByTestId("income-type-salary").click();
    await page.locator("#income-label").fill("Salary");
    await page.locator("#income-amount").fill("20,000");
    await page.locator("#income-received").fill(received);
    await expect(page.locator("#income-period")).toHaveValue(fundedStart);
    await expect(page.getByTestId("split-preview").locator("li")).toHaveCount(4);
    await page.getByTestId("save-income").click();

    const card = page.getByTestId("income-card").first();
    for (const amount of ["20,000.00", "10,000.00", "6,000.00", "3,600.00", "400.00"]) {
      await expect(card).toContainText(amount);
    }

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("income_allocations")
          .select("bucket, amount_cents, period_start")
          .eq("user_id", owner.id)
          .order("amount_cents", { ascending: false });
        return data;
      })
      .toEqual([
        { bucket: "needs", amount_cents: 1_000_000, period_start: fundedStart },
        { bucket: "wants", amount_cents: 600_000, period_start: fundedStart },
        { bucket: "investment", amount_cents: 360_000, period_start: fundedStart },
        { bucket: "investment", amount_cents: 40_000, period_start: fundedStart },
      ]);
  });
});
