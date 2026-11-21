/**
 * Spec 015 · a one-off income added whole to one bucket.
 *  - demo (demo-en, demo-es): the seeded "Birthday gift" shows Wants only, editing opens with that
 *    mode and bucket, Investment asks for a vehicle, and saving is a blocked write.
 *  - live (live-en, live-es): with no rule configured, a $500 gift goes to Wants (one allocation,
 *    distributed, no rule); editing keeps the mode and moving it to Needs moves the allocation.
 */
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import type { Locale } from "../../src/domain/types";
import { expect, openCreate, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const localeOf = (metadata: unknown) =>
  ((metadata as { locale?: Locale }).locale ?? "en") as Locale;

test.describe("Spec 015 · income to one bucket (demo)", { tag: "@demo" }, () => {
  test("the seeded gift is in Wants and editing keeps that mode", async ({ page }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)];

    await page.goto("/income");
    const card = page.getByTestId("income-card").filter({ hasText: "Birthday gift" });
    await expect(card).toContainText(m.buckets.wants);
    await expect(card).not.toContainText(m.buckets.needs);

    await card.getByRole("button", { name: m.income.edit }).click();
    await expect(page.locator("#income-split-bucket")).toHaveAttribute("data-state", "checked");
    await expect(page.locator("#income-bucket-wants")).toHaveAttribute("data-state", "checked");
    await expect(page.getByTestId("split-preview").locator("li")).toHaveCount(1);

    // Investment asks for a vehicle (preselected) and says it doesn't raise what you can spend.
    await page.locator("#income-bucket-investment").click();
    await expect(page.getByTestId("income-vehicle")).not.toHaveValue("");
    await expect(page.getByText(m.income.investmentNote)).toBeVisible();

    await page.getByTestId("save-income").click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: m.common.demoReadOnly }),
    ).toHaveCount(1);
  });

  test("only a one-off income offers the bucket option", async ({ page }) => {
    await page.goto("/income");
    await openCreate(page, "income");
    await page.locator("#income-kind-oneOff").click();
    await expect(page.locator("#income-split-bucket")).toBeVisible();
    await page.locator("#income-kind-recurring").click();
    await expect(page.locator("#income-split-bucket")).toHaveCount(0);
  });
});

test.describe("Spec 015 · income to one bucket (live)", { tag: "@live" }, () => {
  test("a gift goes to Wants without rules, and editing moves it to Needs", async ({
    ownerPage: page,
    admin,
    owner,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)];
    const stored = async () => {
      const { data } = await admin
        .from("incomes")
        .select("distributed, rule_id, income_allocations(bucket, account_id, amount_cents)")
        .eq("user_id", owner.id);
      return data;
    };

    await page.goto("/income");
    await openCreate(page, "income");
    await page.getByTestId("income-type-gift").click();
    await page.locator("#income-amount").fill("500");
    await page.locator("#income-kind-oneOff").click();
    await page.locator("#income-split-bucket").click();
    await expect(page.locator("#income-bucket-wants")).toHaveAttribute("data-state", "checked");
    await expect(page.getByTestId("split-preview").locator("li")).toHaveCount(1);
    await page.getByTestId("save-income").click();

    await expect.poll(stored).toEqual([
      {
        distributed: true,
        rule_id: null,
        income_allocations: [{ bucket: "wants", account_id: null, amount_cents: 50_000 }],
      },
    ]);

    const card = page.getByTestId("income-card").first();
    await card.getByRole("button", { name: m.income.edit }).click();
    await expect(page.locator("#income-split-bucket")).toHaveAttribute("data-state", "checked");
    await expect(page.locator("#income-bucket-wants")).toHaveAttribute("data-state", "checked");
    await page.locator("#income-bucket-needs").click();
    await page.getByTestId("save-income").click();

    await expect.poll(stored).toEqual([
      {
        distributed: true,
        rule_id: null,
        income_allocations: [{ bucket: "needs", account_id: null, amount_cents: 50_000 }],
      },
    ]);
  });
});
