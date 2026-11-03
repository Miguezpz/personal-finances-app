/**
 * T150 · Free-tier cold start and offline (live-en, live-es; R12, FR-048):
 *  - While the database answers slowly or with 503s, the app shows skeletons and "waking up the
 *    database", retries on its own and ends up showing the data — never a raw error.
 *  - Offline, the last loaded data stays visible and a write is refused with a notice: nothing
 *    is queued that looks saved, and nothing reaches the database.
 */
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import type { Locale } from "../../src/domain/types";
import { expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;

test.describe("Cold start and offline", { tag: "@live" }, () => {
  test("a waking database shows skeletons and a notice, then the data", async ({
    ownerPage: page,
  }, testInfo) => {
    const m = MESSAGES[(testInfo.project.metadata as { locale: Locale }).locale];

    // For 8 s from the first data request, every request is slow and answers 503 (Supabase
    // waking up). The clock starts with the first request, so a slow page load (a busy machine)
    // doesn't shorten the outage.
    let wakesAt: number | null = null;
    await page.route("**/rest/v1/**", async (route) => {
      wakesAt ??= Date.now() + 8_000;
      if (Date.now() >= wakesAt) return route.continue();
      await new Promise((r) => setTimeout(r, 600));
      return route.fulfill({ status: 503, body: "Service Unavailable" });
    });

    await page.goto("/dashboard");
    await expect(page.locator("main [aria-busy='true']").first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: m.common.wakingDatabase })).toBeVisible(
      { timeout: 7_000 },
    );
    // Retries with backoff until the database answers; the notice goes away.
    await expect(page.getByTestId("bucket-needs")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(m.common.wakingDatabase)).toHaveCount(0);
    await expect(page.getByText(m.common.unexpectedError)).toHaveCount(0);
  });

  test("offline keeps the loaded data and refuses writes with a notice", async ({
    ownerPage: page,
    context,
    admin,
    owner,
  }, testInfo) => {
    const m = MESSAGES[(testInfo.project.metadata as { locale: Locale }).locale];
    // Default categories come from onboarding (background).
    await expect
      .poll(async () => {
        const { count } = await admin
          .from("subcategories")
          .select("id", { count: "exact", head: true })
          .eq("user_id", owner.id);
        return count ?? 0;
      })
      .toBeGreaterThan(0);

    await page.goto("/expenses");
    await expect(page.getByTestId("add-expense")).toBeEnabled();

    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: m.common.offline })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByTestId("add-expense").click();
    await page.locator("#expense-amount").fill("250");
    await page.locator("#expense-subcategory").selectOption({ index: 1 });
    await page.getByTestId("save-expense").click();

    const toast = page.locator('[data-sonner-toast][data-type="warning"]');
    await expect(toast).toContainText(m.common.offline);
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
    await expect(page.getByTestId("expense-row")).toHaveCount(0);

    await context.setOffline(false);
    await expect(page.getByRole("status").filter({ hasText: m.common.offline })).toHaveCount(0);
    const { count } = await admin
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", owner.id);
    expect(count).toBe(0);
  });
});
