/**
 * T128 · US8 end to end (live-en, live-es): create a credit card with its cut-off and due offset,
 * a subcategory under a Wants category, then find the movements in the ledger with its filters
 * and download the CSV with exactly one row per movement.
 */
import { readFile } from "node:fs/promises";
import { addDays } from "../../src/domain/dates";
import { periodOf, todayIn } from "../../src/domain/periods";
import { expect, test } from "./fixtures";

const TZ = "America/Mexico_City";

test.describe("US8 · settings and ledger", { tag: "@live" }, () => {
  test("catalog changes show up in the ledger, its filters and the CSV export", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    // One income, so the ledger isn't only the expenses created below.
    const today = todayIn(TZ, new Date());
    const period = periodOf(today);
    const received = addDays(period.start, -1);
    const { data: ruleId } = await userClient.rpc("save_distribution_rule", {
      p_rule: { effective_from: received, needs_bps: 5000, wants_bps: 5000, investment_bps: 0 },
      p_subrules: [],
    });
    await userClient.rpc("register_income", {
      p_income: {
        label: "Salary",
        amount_cents: 200_000,
        received_on: received,
        funded_period_start: period.start,
        rule_id: ruleId,
      },
      p_allocations: [
        { bucket: "needs", amount_cents: 100_000, period_start: period.start },
        { bucket: "wants", amount_cents: 100_000, period_start: period.start },
      ],
    });

    // Onboarding creates the default taxonomy in the background.
    let diningOut: string | undefined;
    let groceries: string | undefined;
    await expect
      .poll(async () => {
        const [{ data: cats }, { data: subs }] = await Promise.all([
          admin
            .from("categories")
            .select("id")
            .eq("user_id", owner.id)
            .eq("name_key", "taxonomy.diningOut"),
          admin
            .from("subcategories")
            .select("id")
            .eq("user_id", owner.id)
            .eq("name_key", "taxonomy.groceries"),
        ]);
        diningOut = cats?.[0]?.id;
        groceries = subs?.[0]?.id;
        return Boolean(diningOut && groceries);
      })
      .toBe(true);

    // --- A credit card with cut-off day 12, due 20 days later --------------------------
    await page.goto("/settings/accounts");
    await page.getByTestId("add-account").click();
    await page.locator("#account-kind").selectOption("credit_card");
    await page.locator("#account-name").fill("E2E Card");
    await page.locator("#account-cutoff").fill("12");
    await page.locator("#account-due").fill("20");
    await page.getByTestId("save-account").click();

    let cardId: string | undefined;
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("accounts")
          .select("id, kind, cut_off_day, payment_due_offset_days")
          .eq("user_id", owner.id)
          .eq("name", "E2E Card");
        const row = data?.[0];
        cardId = row?.id;
        return row ? [row.kind, row.cut_off_day, row.payment_due_offset_days] : null;
      })
      .toEqual(["credit_card", 12, 20]);
    await expect(page.locator(`[data-testid="account-card"][data-id="${cardId}"]`)).toBeVisible();

    // --- A subcategory "Pets" under the Wants category "Dining out" -----------------------
    await page.goto("/settings/categories");
    const category = page.locator(`[data-testid="category-card"][data-id="${diningOut}"]`);
    await category.getByTestId("add-subcategory").click();
    await page.locator("#taxonomy-name").fill("Pets");
    await page.getByTestId("save-taxonomy").click();
    await expect(category.getByTestId("subcategory-row").filter({ hasText: "Pets" })).toBeVisible();

    let pets: string | undefined;
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("subcategories")
          .select("id, category_id")
          .eq("user_id", owner.id)
          .eq("name", "Pets");
        pets = data?.[0]?.id;
        return data?.[0]?.category_id;
      })
      .toBe(diningOut);

    // Two expenses: one in Pets with the new card, one in Groceries without an account.
    const { error } = await userClient.from("expenses").insert([
      {
        amount_cents: 25_000,
        spent_on: today,
        subcategory_id: pets as string,
        bucket: "wants",
        payment_account_id: cardId as string,
        note: "Vet, checkup",
      },
      {
        amount_cents: 12_345,
        spent_on: today,
        subcategory_id: groceries as string,
        bucket: "needs",
      },
    ]);
    expect(error).toBeNull();

    // --- Ledger: 3 movements; each filter narrows to the expected one ---------------------
    await page.goto("/ledger");
    const rows = page.getByTestId("ledger-row");
    await expect(rows).toHaveCount(3);

    const filters = page.getByTestId("toggle-ledger-filters");
    if (await filters.isVisible()) await filters.click();

    await page.locator("#ledger-category").selectOption(diningOut as string);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Vet, checkup");
    await page.getByTestId("clear-ledger-filters").click();

    await page.locator("#ledger-account").selectOption(cardId as string);
    await expect(rows).toHaveCount(1);
    await page.getByTestId("clear-ledger-filters").click();

    await page.locator("#ledger-type").selectOption("income");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-type", "income");
    await page.getByTestId("clear-ledger-filters").click();
    await expect(rows).toHaveCount(3);

    // --- CSV: header + one row per movement, MXN amounts as stored -----------------------
    await page.getByTestId("export-data").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-ledger-csv").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^ledger-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await readFile((await download.path()) as string, "utf8");
    const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "date,type,description,amount_mxn,account,bucket,subcategory,third_party",
    );
    expect(lines).toHaveLength(4);
    expect(lines).toContain(`${today},expense,"Vet, checkup",-250.00,E2E Card,wants,Pets,false`);
    expect(lines.some((l) => l.includes(",income,Salary,2000.00,"))).toBe(true);
    expect(lines.some((l) => l.includes(",-123.45,"))).toBe(true);
  });
});
