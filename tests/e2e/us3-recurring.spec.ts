/**
 * T086 · US3 end to end (live-en, live-es): create "Rent" charged today, reload twice and find
 * exactly ONE applied occurrence (idempotent materialization, FR-010 / SC-005); it shows as
 * charged on the dashboard; pausing it stops further charges (US3-6).
 */
import { parseIsoDate } from "../../src/domain/dates";
import { todayIn } from "../../src/domain/periods";
import { expect, test } from "./fixtures";

const TZ = "America/Mexico_City";

test.describe("US3 · recurring expenses", { tag: "@live" }, () => {
  test("is applied exactly once and stops when paused", async ({
    ownerPage: page,
    admin,
    owner,
  }) => {
    const today = todayIn(TZ, new Date());
    const { day } = parseIsoDate(today);

    const appliedRent = async () => {
      const { data } = await admin
        .from("expenses")
        .select("occurrence_date, amount_cents, bucket, note")
        .eq("user_id", owner.id)
        .eq("origin", "recurring");
      return data ?? [];
    };

    // Default taxonomy (onboarding) must exist before choosing a category.
    let rentSub: string | undefined;
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("subcategories")
          .select("id")
          .eq("user_id", owner.id)
          .eq("name", "Rent"); // Housing › Rent (spec 004 default, no i18n key)
        rentSub = data?.[0]?.id;
        return rentSub;
      })
      .toBeTruthy();

    await page.goto("/recurring");
    await page.getByTestId("add-recurring").click();
    await page.locator("#recurring-name").fill("Rent");
    await page.locator("#recurring-amount").fill("8,000");
    await page.locator("#recurring-day").fill(String(day));
    await page.locator("#recurring-subcategory").selectOption(rentSub ?? "");
    await page.getByTestId("save-recurring").click();
    await expect(page.getByTestId("recurring-card")).toHaveAttribute("data-status", "active");

    // Charged today → materialized in the background.
    await expect
      .poll(appliedRent)
      .toEqual([{ occurrence_date: today, amount_cents: 800_000, bucket: "needs", note: "Rent" }]);

    // Reopening the app twice never duplicates it.
    for (let i = 0; i < 2; i++) {
      await page.reload();
      await expect(page.getByTestId("recurring-card")).toBeVisible();
      await page.waitForTimeout(800);
    }
    expect(await appliedRent()).toHaveLength(1);

    // The dashboard lists it as charged in Needs.
    await page.goto("/dashboard");
    await expect(
      page.getByTestId("recurring-needs").locator('li[data-status="applied"]'),
    ).toHaveCount(1);

    // Pause: it's marked as paused and nothing else is charged.
    await page.goto("/recurring");
    await page.getByTestId("toggle-recurring").click();
    await expect(page.getByTestId("recurring-card")).toHaveAttribute("data-status", "paused");
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("recurring_expenses")
          .select("ended_on")
          .eq("user_id", owner.id);
        return data?.[0]?.ended_on;
      })
      .toBe(today);
    await page.reload();
    await expect(page.getByTestId("recurring-card")).toHaveAttribute("data-status", "paused");
    await page.waitForTimeout(800);
    expect(await appliedRent()).toHaveLength(1);
  });
});
