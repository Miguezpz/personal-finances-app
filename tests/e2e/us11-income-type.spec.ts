/**
 * Spec 004 · US2 end to end (live-en + live-es): the income type is mandatory with nothing
 * preselected, choosing it with an empty label fills the label in, the list shows the type, and
 * editing changes the type without touching the amount. The demo side (a type change is a blocked
 * write) is covered by us9-demo.spec.ts.
 */
import { expect, test } from "./fixtures";

const TEXT = {
  en: { required: "Choose an income type", salary: "Salary", gift: "Gift", edit: "Edit" },
  es: { required: "Elige un tipo de ingreso", salary: "Salario", gift: "Regalo", edit: "Editar" },
} as const;

test.describe("Spec 004 · income type", { tag: "@live" }, () => {
  test("is required, suggests the label and can be changed when editing", async ({
    ownerPage: page,
    admin,
    owner,
  }, testInfo) => {
    const text = TEXT[(testInfo.project.metadata.locale as "en" | "es") ?? "en"];

    await page.goto("/income");
    await page.getByTestId("register-income").click();
    await page.locator("#income-amount").fill("1,500");
    // No rule configured: record it without splitting.
    await page.locator("#income-split-no").click();

    // --- Nothing preselected; saving without a type is refused -------------------------
    const types = page.getByTestId("income-type");
    await expect(types.getByRole("radio", { checked: true })).toHaveCount(0);
    await page.getByTestId("save-income").click();
    await expect(page.locator("#income-type-error")).toHaveText(text.required);
    await expect(page.getByRole("dialog")).toBeVisible();

    // --- Choosing a type fills the empty label; typed text is never overwritten --------
    await page.getByTestId("income-type-salary").click();
    await expect(page.locator("#income-label")).toHaveValue(text.salary);
    await page.getByTestId("income-type-gift").click();
    await expect(page.locator("#income-label")).toHaveValue(text.gift); // still the suggestion
    await page.locator("#income-label").fill("Birthday");
    await page.getByTestId("income-type-salary").click();
    await expect(page.locator("#income-label")).toHaveValue("Birthday");
    await expect(page.locator("#income-type-error")).toHaveCount(0);

    await page.getByTestId("save-income").click();
    const card = page.getByTestId("income-card").first();
    await expect(card).toContainText("Birthday");
    await expect(card.getByTestId("income-type-badge")).toHaveText(text.salary);
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("incomes")
          .select("income_type, amount_cents")
          .eq("user_id", owner.id);
        return data;
      })
      .toEqual([{ income_type: "salary", amount_cents: 150_000 }]);

    // --- Editing keeps the stored type selected and changes it ------------------------
    // Reload so the list holds the server id (a just-created row keeps a temporary id until the
    // snapshot refetch lands; editing it earlier is a separate, pre-existing race).
    await page.reload();
    await card.getByRole("button", { name: text.edit }).click();
    await expect(page.getByTestId("income-type-salary")).toHaveAttribute("data-state", "checked");
    await page.getByTestId("income-type-gift").click();
    await expect(page.locator("#income-label")).toHaveValue("Birthday");
    await page.getByTestId("save-income").click();
    await expect(card.getByTestId("income-type-badge")).toHaveText(text.gift);
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("incomes")
          .select("income_type, amount_cents, distributed")
          .eq("user_id", owner.id);
        return data;
      })
      .toEqual([{ income_type: "gift", amount_cents: 150_000, distributed: false }]);
  });
});
