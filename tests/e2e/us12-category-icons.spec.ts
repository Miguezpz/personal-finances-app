/**
 * Spec 004 · US3 end to end: a category icon chosen with the keyboard shows up in expenses, the
 * ledger and recurring expenses; a subcategory inherits it, can get its own and can go back to
 * inheriting; a user-created category shows the generic icon. In the demo the change is refused
 * with the read-only toast.
 * Icons are located by their `data-icon` key (they are aria-hidden, so they have no text).
 */
import type { Page } from "@playwright/test";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;

const localeOf = (metadata: Record<string, unknown>) => (metadata.locale === "es" ? "es" : "en");

async function chooseIcon(page: Page, trigger: ReturnType<Page["getByTestId"]>, option: string) {
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId(`icon-option-${option}`).click();
  await dialog.getByTestId("save-icon").click();
  await expect(dialog).toBeHidden();
}

test.describe("Spec 004 · category icons", { tag: "@live" }, () => {
  test("change, inherit and show the icon everywhere", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    test.setTimeout(90_000); // several pages and DB round trips
    // Onboarding creates the default taxonomy in the background.
    let streaming: string | undefined;
    let video: string | undefined;
    await expect
      .poll(async () => {
        const { data: cat } = await admin
          .from("categories")
          .select("id, icon")
          .eq("user_id", owner.id)
          .eq("name", "Streaming");
        streaming = cat?.[0]?.id;
        const { data: sub } = await admin
          .from("subcategories")
          .select("id")
          .eq("user_id", owner.id)
          .eq("name", "Video streaming");
        video = sub?.[0]?.id;
        return cat?.[0]?.icon && video ? cat[0].icon : null;
      })
      .toBe("tv");

    const today = new Date().toISOString().slice(0, 10);
    const { error } = await userClient.from("expenses").insert({
      amount_cents: 19_900,
      spent_on: today,
      subcategory_id: video as string,
      bucket: "wants",
      note: "Icons e2e",
    });
    expect(error).toBeNull();
    const { error: recErr } = await userClient.from("recurring_expenses").insert({
      name: "Video plan",
      amount_cents: 19_900,
      charge_day: 28,
      subcategory_id: video as string,
      bucket: "wants",
      starts_on: today,
    });
    expect(recErr).toBeNull();

    // --- The category icon, chosen with the keyboard ------------------------------------
    await page.goto("/settings/categories");
    const card = page.locator(`[data-testid="category-card"][data-id="${streaming}"]`);
    const categoryPicker = card.getByTestId("icon-picker").first();
    await expect(categoryPicker).toHaveAttribute("data-icon", "tv");
    await chooseIcon(page, categoryPicker, "film");
    await expect(categoryPicker).toHaveAttribute("data-icon", "film");
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("categories")
          .select("icon")
          .eq("id", streaming as string);
        return data?.[0]?.icon;
      })
      .toBe("film");

    // --- The subcategory inherits it, gets its own, and goes back to inheriting ---------
    const row = card.getByTestId("subcategory-row").filter({ hasText: "Video streaming" });
    const subPicker = row.getByTestId("icon-picker");
    await expect(subPicker).toHaveAttribute("data-icon", "film");
    await chooseIcon(page, subPicker, "coffee");
    await expect(subPicker).toHaveAttribute("data-icon", "coffee");
    const subIcon = async () => {
      const { data } = await admin
        .from("subcategories")
        .select("icon")
        .eq("id", video as string);
      return data?.[0]?.icon ?? null;
    };
    await expect.poll(subIcon).toBe("coffee");
    await chooseIcon(page, subPicker, "inherit");
    await expect(subPicker).toHaveAttribute("data-icon", "film");
    await expect.poll(subIcon).toBeNull();

    // --- Shown next to the name in expenses, the ledger and recurring -------------------
    await page.goto("/expenses");
    await expect(
      page
        .getByTestId("expense-row")
        .filter({ hasText: "Icons e2e" })
        .locator('svg[data-icon="film"]'),
    ).toHaveCount(1);
    await page.goto("/ledger");
    await expect(
      page
        .locator('[data-testid="ledger-row"], [data-testid="ledger-card"]')
        .filter({ hasText: "Icons e2e" })
        .locator('svg[data-icon="film"]')
        .first(),
    ).toBeAttached();
    await page.goto("/recurring");
    await expect(
      page
        .getByTestId("recurring-card")
        .filter({ hasText: "Video plan" })
        .locator('svg[data-icon="film"]'),
    ).toHaveCount(1);

    // --- A user-created category without an icon shows the generic one -------------------
    await page.goto("/settings/categories");
    await page.getByTestId("add-category").click();
    await page.locator("#taxonomy-name").fill("Garden");
    await page.getByTestId("save-taxonomy").click();
    const garden = page.getByTestId("category-card").filter({ hasText: "Garden" });
    await expect(garden.getByTestId("icon-picker").first()).toHaveAttribute("data-icon", "generic");
  });
});

test.describe("Spec 004 · category icons in the demo", { tag: "@demo" }, () => {
  test("changing an icon is refused as read-only", async ({ page }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    await page.goto("/settings/categories");
    const card = page.getByTestId("category-card").first();
    await expect(card).toBeVisible();
    await expect(page.getByTestId("category-card")).toHaveCount(26);
    const picker = card.getByTestId("icon-picker").first();
    const before = await picker.getAttribute("data-icon");
    await chooseIcon(page, picker, before === "gift" ? "tag" : "gift");
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: MESSAGES[locale].common.demoReadOnly }),
    ).toHaveCount(1);
    await expect(picker).toHaveAttribute("data-icon", before ?? "");
  });
});
