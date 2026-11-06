/**
 * Spec 005 · Quick expenses end to end.
 *  - live-en, live-es: a tap records today's expense and lowers Needs at once; Undo restores it;
 *    two taps record two; "⋯ › Yesterday" and "⋯ › another amount" (the template keeps its
 *    amount); the floating button's dialog records with one tap on a phone; the edit dialog has
 *    no quick row (quickstart C, D, E, F1–F4).
 *  - demo-en, demo-es: "Transporte $24" is on the Dashboard and a tap is refused read-only.
 */
import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/data/supabase/database.types";
import { addDays } from "../../src/domain/dates";
import { periodOf, todayIn } from "../../src/domain/periods";
import type { Locale } from "../../src/domain/types";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { expect, test, type Owner } from "./fixtures";

const MESSAGES = { en, es } as const;
const TZ = "America/Mexico_City";
const DEMO_TEMPLATE_ID = "00000000-0000-4000-8000-000000004001";

const localeOf = (metadata: unknown) => (metadata as { locale: Locale }).locale;

/** $1,000 in Needs for the current quincena and a "Transporte · $24" template in Public transport. */
async function seed(
  admin: SupabaseClient<Database>,
  owner: Owner,
  userClient: SupabaseClient<Database>,
  extra: { name: string; amount_cents: number; sort: number }[] = [],
) {
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

  let subcategoryId: string | undefined;
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("subcategories")
        .select("id")
        .eq("user_id", owner.id)
        .eq("name", "Public transport"); // Transport & Gas › Public transport (default taxonomy)
      subcategoryId = data?.[0]?.id;
      return subcategoryId;
    })
    .toBeTruthy();

  const { data: rows, error } = await userClient
    .from("expense_templates")
    .insert(
      [{ name: "Transporte", amount_cents: 2400, sort: 0 }, ...extra].map((t) => ({
        ...t,
        subcategory_id: subcategoryId as string,
      })),
    )
    .select("id, name");
  expect(error).toBeNull();
  const id = (name: string) => rows?.find((r) => r.name === name)?.id as string;
  return { today, subcategoryId: subcategoryId as string, templateId: id("Transporte"), id };
}

const expensesOf = async (admin: SupabaseClient<Database>, owner: Owner) =>
  (
    await admin
      .from("expenses")
      .select("amount_cents, spent_on, note, origin, bucket")
      .eq("user_id", owner.id)
      .order("spent_on")
  ).data;

async function openDashboard(page: Page) {
  await page.goto("/dashboard");
  await expect(page.getByTestId("quick-expense-bar")).toBeVisible();
}

test.describe("US13 · quick expenses", { tag: "@live" }, () => {
  test("a tap records today's expense at once, and Undo restores the balance", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)].quickExpenses;
    const { today, templateId } = await seed(admin, owner, userClient);
    await openDashboard(page);
    const needs = page.getByTestId("bucket-needs-balance");
    await expect(needs).toContainText("$1,000.00");

    await page.getByTestId(`quick-expense-${templateId}`).click();
    await expect(needs).toContainText("$976.00");
    const toast = page.locator("[data-sonner-toast]").filter({
      hasText: m.added.replace("{name}", "Transporte"),
    });
    await expect(toast).toBeVisible();
    await expect
      .poll(() => expensesOf(admin, owner))
      .toEqual([
        {
          amount_cents: 2400,
          spent_on: today,
          note: "Transporte",
          origin: "manual",
          bucket: "needs",
        },
      ]);

    await toast.getByRole("button", { name: m.undo }).click();
    await expect(needs).toContainText("$1,000.00");
    await expect.poll(() => expensesOf(admin, owner)).toEqual([]);

    // Two taps in a row: two expenses (FR-010).
    const button = page.getByTestId(`quick-expense-${templateId}`);
    await button.click();
    await button.click();
    await expect(needs).toContainText("$952.00");
    await expect.poll(async () => (await expensesOf(admin, owner))?.length).toBe(2);
  });

  test("the ⋯ menu records for yesterday or with another amount; the template keeps $24", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)].quickExpenses;
    const { today, templateId } = await seed(admin, owner, userClient);
    await openDashboard(page);

    await page.getByTestId(`quick-expense-menu-${templateId}`).click();
    await page.getByRole("menuitem", { name: m.yesterday }).click();
    await expect
      .poll(() => expensesOf(admin, owner))
      .toEqual([
        {
          amount_cents: 2400,
          spent_on: addDays(today, -1),
          note: "Transporte",
          origin: "manual",
          bucket: "needs",
        },
      ]);

    // Reopen only once the first menu has finished closing.
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByTestId(`quick-expense-menu-${templateId}`).click();
    await page.getByRole("menuitem", { name: m.customize }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#quick-expense-amount")).toHaveValue("24.00");
    await expect(dialog.locator("#quick-expense-date")).toHaveValue(today);
    // A future date is refused.
    await dialog.locator("#quick-expense-date").fill(addDays(today, 1));
    await dialog.getByTestId("quick-expense-register").click();
    await expect(dialog.getByText(m.futureDate)).toBeVisible();
    await dialog.locator("#quick-expense-date").fill(today);
    await dialog.locator("#quick-expense-amount").fill("12");
    await dialog.getByTestId("quick-expense-register").click();
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () => (await expensesOf(admin, owner))?.map((e) => e.amount_cents))
      .toEqual([2400, 1200]);
    const { data: template } = await admin
      .from("expense_templates")
      .select("amount_cents")
      .eq("id", templateId)
      .single();
    expect(template?.amount_cents).toBe(2400);
    await expect(page.getByTestId(`quick-expense-${templateId}`)).toContainText("$24.00");
  });

  test("on a phone, the floating button's dialog records with one tap; editing has no quick row", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    const { today, templateId } = await seed(admin, owner, userClient);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/goals");

    await page.getByTestId("fab-add-expense").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("quick-expense-bar")).toBeVisible();
    await dialog.getByTestId(`quick-expense-${templateId}`).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(() => expensesOf(admin, owner))
      .toEqual([
        {
          amount_cents: 2400,
          spent_on: today,
          note: "Transporte",
          origin: "manual",
          bucket: "needs",
        },
      ]);

    // The edit dialog of that expense shows no quick row (FR-006a).
    await page.goto("/expenses");
    const row = page.getByTestId("expense-row").first();
    await expect(row).toContainText("Transporte");
    await row.getByRole("button").first().click();
    const edit = page.getByRole("dialog");
    await expect(edit.locator("#expense-amount")).toHaveValue("24.00");
    await expect(edit.getByTestId("quick-expense-bar")).toHaveCount(0);
  });
});

test.describe("US13 · quick expenses in the demo", { tag: "@demo" }, () => {
  test("Transporte $24 is on the Dashboard and a tap is refused read-only", async ({
    page,
  }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    await openDashboard(page);
    const button = page.getByTestId(`quick-expense-${DEMO_TEMPLATE_ID}`);
    await expect(button).toContainText("Transporte");
    await expect(button).toContainText("$24.00");
    const needs = page.getByTestId("bucket-needs-balance").locator(".money").first();
    const before = (await needs.textContent()) ?? "";

    await button.click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: MESSAGES[locale].common.demoReadOnly }),
    ).toHaveCount(1);
    await expect(
      page.locator("[data-sonner-toast]").filter({
        hasText: MESSAGES[locale].quickExpenses.added.replace("{name}", "Transporte"),
      }),
    ).toHaveCount(0);
    await expect(needs).toHaveText(before);
  });
});
