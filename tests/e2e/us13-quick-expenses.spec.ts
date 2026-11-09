/**
 * Spec 005 · Quick expenses end to end.
 * Quick expenses live only where an expense is registered (the new-expense dialog and the mobile
 * "＋" sheet), never on the Dashboard.
 *  - live-en, live-es: a tap records today's expense and lowers Needs at once; Undo restores it;
 *    two taps record two; "⋯ › Yesterday" and "⋯ › another amount" (the template keeps its
 *    amount); the floating button's dialog records with one tap on a phone; the edit dialog has
 *    no quick row (quickstart C, D, E, F1–F4).
 *  - live: managing templates in Settings (create, edit, reorder, delete, archived subcategory)
 *    and "Save as quick expense" in the expense dialog (quickstart B, F, G, H, I, J).
 *  - demo-en, demo-es: "Transporte $24" is in the new-expense dialog, not on the Dashboard; a tap,
 *    creating and deleting are refused read-only.
 */
import type { Locator, Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/data/supabase/database.types";
import { addDays } from "../../src/domain/dates";
import { periodOf, todayIn } from "../../src/domain/periods";
import type { Locale } from "../../src/domain/types";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { expect, openCreate, test, type Owner } from "./fixtures";

const MESSAGES = { en, es } as const;
const TZ = "America/Mexico_City";
const DEMO_TEMPLATE_ID = "00000000-0000-4000-8000-000000004001";

const localeOf = (metadata: unknown) => (metadata as { locale: Locale }).locale;

/** $1,000 in Needs for the current quincena and a "Transporte · $24" template in Public transport. */
async function seed(
  admin: SupabaseClient<Database>,
  owner: Owner,
  userClient: SupabaseClient<Database>,
  templates: { name: string; amount_cents: number; sort: number }[] = [
    { name: "Transporte", amount_cents: 2400, sort: 0 },
  ],
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

  const { data: rows, error } =
    templates.length === 0
      ? { data: [], error: null }
      : await userClient
          .from("expense_templates")
          .insert(templates.map((t) => ({ ...t, subcategory_id: subcategoryId as string })))
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

const templatesOf = async (admin: SupabaseClient<Database>, owner: Owner) =>
  (
    await admin
      .from("expense_templates")
      .select("name, amount_cents, archived, payment_account_id")
      .eq("user_id", owner.id)
      .order("created_at")
  ).data;

/** Template ids in the quick row's order. */
const barOrder = (dialog: Locator) =>
  dialog
    .getByTestId("quick-expense-bar")
    .locator('[data-testid^="quick-expense-"]:not([data-testid^="quick-expense-menu-"])')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));

/** Opens the new-expense dialog, the quick row's home; a tap there records and closes it. */
async function openQuickExpenses(page: Page) {
  const dialog = await openCreate(page, "expense");
  await expect(dialog.getByTestId("quick-expense-bar")).toBeVisible();
  return dialog;
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
    await page.goto("/dashboard");
    const needs = page.getByTestId("bucket-needs-balance");
    await expect(needs).toContainText("$1,000.00");
    // Not on the Dashboard: only where an expense is registered.
    await expect(page.getByTestId("quick-expense-bar")).toHaveCount(0);

    let dialog = await openQuickExpenses(page);
    await dialog.getByTestId(`quick-expense-${templateId}`).click();
    await expect(dialog).toBeHidden();
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

    // Two taps: two expenses (FR-010).
    for (let i = 0; i < 2; i++) {
      dialog = await openQuickExpenses(page);
      await dialog.getByTestId(`quick-expense-${templateId}`).click();
      await expect(dialog).toBeHidden();
    }
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
    await page.goto("/dashboard");

    let expenseDialog = await openQuickExpenses(page);
    await expenseDialog.getByTestId(`quick-expense-menu-${templateId}`).click();
    await page.getByRole("menuitem", { name: m.yesterday }).click();
    await expect(expenseDialog).toBeHidden();
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
    expenseDialog = await openQuickExpenses(page);
    await expenseDialog.getByTestId(`quick-expense-menu-${templateId}`).click();
    await page.getByRole("menuitem", { name: m.customize }).click();
    // It opens on top of the new-expense dialog.
    const dialog = page.getByRole("dialog").filter({ has: page.locator("#quick-expense-amount") });
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
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expenseDialog = await openQuickExpenses(page);
    await expect(expenseDialog.getByTestId(`quick-expense-${templateId}`)).toContainText("$24.00");
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

    const dialog = await openCreate(page, "expense");
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

test.describe("US13 · managing quick expenses", { tag: "@live" }, () => {
  test("create one in Settings, then edit it; recorded expenses keep their amount", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)].quickExpenses;
    const { subcategoryId } = await seed(admin, owner, userClient, []);
    // Without templates the new-expense dialog has no quick row.
    await page.goto("/dashboard");
    let expenseDialog = await openCreate(page, "expense");
    await expect(expenseDialog.locator("#expense-amount")).toBeVisible();
    await expect(expenseDialog.getByTestId("quick-expense-bar")).toHaveCount(0);

    await page.goto("/settings/quick-expenses");
    const section = page.getByTestId("quick-expenses-section");
    await expect(section.getByText(m.empty)).toBeVisible();

    // B: create "Transporte · $24 · Public transport"; validation first.
    await section.getByTestId("create-template").click();
    let dialog = page.getByRole("dialog");
    await dialog.getByTestId("save-template").click();
    await expect(dialog.getByText(m.nameRequired)).toBeVisible();
    await expect(dialog.getByText(m.invalidAmount)).toBeVisible();
    await expect(dialog.getByText(m.subcategoryRequired)).toBeVisible();
    await dialog.locator("#template-name").fill("Transporte");
    await dialog.locator("#template-amount").fill("24");
    await dialog.locator("#template-subcategory").selectOption(subcategoryId);
    await dialog.getByTestId("save-template").click();
    await expect(dialog).toBeHidden();
    const row = section.getByTestId("template-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Transporte");
    await expect(row).toContainText("$24.00");
    await expect
      .poll(() => templatesOf(admin, owner))
      .toEqual([
        { name: "Transporte", amount_cents: 2400, archived: false, payment_account_id: null },
      ]);

    // It's in the new-expense dialog; record one at $24.
    await page.goto("/dashboard");
    expenseDialog = await openQuickExpenses(page);
    const templateId = (await expenseDialog
      .getByTestId("quick-expense-bar")
      .locator("li button")
      .first()
      .getAttribute("data-testid"))!.replace("quick-expense-", "");
    await expenseDialog.getByTestId(`quick-expense-${templateId}`).click();
    await expect.poll(async () => (await expensesOf(admin, owner))?.length).toBe(1);

    // F: edit to $30 → the next tap records $30, the first expense stays at $24.
    await page.goto("/settings/quick-expenses");
    await section.getByTestId("template-menu").click();
    await page.getByTestId("template-edit").click();
    dialog = page.getByRole("dialog");
    await expect(dialog.locator("#template-amount")).toHaveValue("24.00");
    await dialog.locator("#template-amount").fill("30");
    await dialog.getByTestId("save-template").click();
    await expect(section.getByTestId("template-row")).toContainText("$30.00");
    await page.goto("/dashboard");
    expenseDialog = await openQuickExpenses(page);
    await expect(expenseDialog.getByTestId(`quick-expense-${templateId}`)).toContainText("$30.00");
    await expenseDialog.getByTestId(`quick-expense-${templateId}`).click();
    await expect
      .poll(async () => (await expensesOf(admin, owner))?.map((e) => e.amount_cents).sort())
      .toEqual([2400, 3000]);
  });

  test("reorder, delete and an archived subcategory", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    const { id, subcategoryId } = await seed(admin, owner, userClient, [
      { name: "Transporte", amount_cents: 2400, sort: 0 },
      { name: "Café", amount_cents: 5500, sort: 1 },
    ]);
    const [transporte, cafe] = [id("Transporte"), id("Café")];
    await page.goto("/dashboard");
    let expenseDialog = await openQuickExpenses(page);
    expect(await barOrder(expenseDialog)).toEqual([
      `quick-expense-${transporte}`,
      `quick-expense-${cafe}`,
    ]);
    await expenseDialog.getByTestId(`quick-expense-${cafe}`).click();
    await expect.poll(async () => (await expensesOf(admin, owner))?.length).toBe(1);

    // G: move Transporte down → the quick row shows Café first.
    await page.goto("/settings/quick-expenses");
    const section = page.getByTestId("quick-expenses-section");
    const rows = section.getByTestId("template-row");
    await rows.first().getByTestId("template-menu").click();
    await expect(page.getByTestId("template-up")).toHaveAttribute("data-disabled", "");
    await page.keyboard.press("Escape");
    // A closed menu stays mounted while it animates out; wait for it to go.
    await expect(page.getByRole("menu")).toHaveCount(0);
    await rows.last().getByTestId("template-menu").click();
    await expect(page.getByTestId("template-down")).toHaveAttribute("data-disabled", "");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await rows.first().getByTestId("template-menu").click();
    await page.getByTestId("template-down").click();
    await expect(rows.first()).toContainText("Café");
    await page.goto("/dashboard");
    expenseDialog = await openQuickExpenses(page);
    await expect
      .poll(() => barOrder(expenseDialog))
      .toEqual([`quick-expense-${cafe}`, `quick-expense-${transporte}`]);

    // H: delete Café → gone from the quick row, its expense stays.
    await page.goto("/settings/quick-expenses");
    await section.locator(`[data-template="${cafe}"]`).getByTestId("template-menu").click();
    await page.getByTestId("template-delete").click();
    await page.getByTestId("confirm-delete-template").click();
    await expect(rows).toHaveCount(1);
    await expect
      .poll(async () => (await templatesOf(admin, owner))?.map((t) => [t.name, t.archived]))
      .toEqual([
        ["Transporte", false],
        ["Café", true],
      ]);
    expect(await expensesOf(admin, owner)).toHaveLength(1);
    await page.goto("/dashboard");
    expenseDialog = await openQuickExpenses(page);
    await expect(expenseDialog.getByTestId(`quick-expense-${cafe}`)).toHaveCount(0);

    // I: archiving its subcategory disables the button, with the reason.
    const { error } = await userClient
      .from("subcategories")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", subcategoryId);
    expect(error).toBeNull();
    await page.reload();
    expenseDialog = await openQuickExpenses(page);
    await expect(expenseDialog.getByTestId(`quick-expense-${transporte}`)).toBeDisabled();
  });

  test("Save as quick expense creates the template with the expense (note, or the subcategory name)", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    const { subcategoryId } = await seed(admin, owner, userClient, []);
    await page.goto("/settings/quick-expenses");
    await expect(page.getByTestId("quick-expenses-section")).toBeVisible();

    const addWithSwitch = async (amount: string, note: string) => {
      const dialog = await openCreate(page, "expense");
      await dialog.locator("#expense-amount").fill(amount);
      await dialog.locator("#expense-subcategory").selectOption(subcategoryId);
      await dialog.locator("#expense-note").fill(note);
      await dialog.getByTestId("save-as-template").click();
      await expect(dialog.getByTestId("save-as-template")).toHaveAttribute("data-state", "checked");
      await dialog.getByTestId("save-expense").click();
      await expect(dialog).toBeHidden();
    };

    await addWithSwitch("24", "Transporte");
    await expect
      .poll(() => templatesOf(admin, owner))
      .toEqual([
        { name: "Transporte", amount_cents: 2400, archived: false, payment_account_id: null },
      ]);
    await addWithSwitch("12", "");
    await expect
      .poll(async () => (await templatesOf(admin, owner))?.map((t) => [t.name, t.amount_cents]))
      .toEqual([
        ["Transporte", 2400],
        ["Public transport", 1200],
      ]);
    expect(await expensesOf(admin, owner)).toHaveLength(2);
    await expect(page.getByTestId("template-row")).toHaveCount(2);

    // The edit dialog has neither the quick row nor the switch.
    await page.goto("/expenses");
    await page
      .getByTestId("expense-row")
      .first()
      .getByRole("button", { name: /^(edit|editar)$/i })
      .click();
    const edit = page.getByRole("dialog");
    await expect(edit.locator("#expense-amount")).toBeVisible();
    await expect(edit.getByTestId("save-as-template")).toHaveCount(0);
    await expect(edit.getByTestId("quick-expense-bar")).toHaveCount(0);
  });
});

test.describe("US13 · quick expenses in the demo", { tag: "@demo" }, () => {
  test("Transporte $24 is in the new-expense dialog, not on the Dashboard; a tap is refused read-only", async ({
    page,
  }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    await page.goto("/dashboard");
    await expect(page.getByTestId("bucket-needs-balance")).toBeVisible();
    await expect(page.getByTestId("quick-expense-bar")).toHaveCount(0);
    const dialog = await openQuickExpenses(page);
    const button = dialog.getByTestId(`quick-expense-${DEMO_TEMPLATE_ID}`);
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
  test("creating or deleting a quick expense is refused read-only", async ({ page }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    const m = MESSAGES[locale].quickExpenses;
    const readOnly = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: MESSAGES[locale].common.demoReadOnly });
    await page.goto("/settings/quick-expenses");
    const section = page.getByTestId("quick-expenses-section");
    await expect(section.getByTestId("template-row")).toHaveCount(1);

    await section.getByTestId("create-template").click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#template-name").fill("Café");
    await dialog.locator("#template-amount").fill("55");
    await dialog.locator("#template-subcategory").selectOption({ index: 1 });
    await dialog.getByTestId("save-template").click();
    await expect(readOnly).toHaveCount(1);
    await expect(section.getByTestId("template-row")).toHaveCount(1);

    await section.getByTestId("template-menu").click();
    await page.getByTestId("template-delete").click();
    await page.getByTestId("confirm-delete-template").click();
    await expect(readOnly.first()).toBeVisible();
    await expect(section.getByTestId("template-row")).toHaveCount(1);
    await expect(section.getByText(m.empty)).toHaveCount(0);
  });
});
