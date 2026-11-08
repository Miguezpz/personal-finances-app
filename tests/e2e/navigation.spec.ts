/**
 * Spec 008 · navigation and shell (demo-en, demo-es; the live projects are skipped by the owner's
 * decision for UI-only work, but the tests carry no tag so they run there too):
 *  - US1: grouped sidebar that scrolls on its own; every route marks a destination as current.
 *  - US2: the desktop "＋ New" menu, the N/I/P shortcuts (not while typing) and a single dialog.
 *  - US3: Credit and Expenses show the same statement per card; "Pay" prefills the card.
 *  - US4: every page header has an icon; settings sub-pages link back to Settings.
 */
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import type { Locale } from "../../src/domain/types";
import { APP_ROUTES } from "./app-routes";
import { expect, openCreate, test } from "./fixtures";

const MESSAGES = { en, es } as const;

test.describe("Spec 008 · navigation", { tag: "@demo" }, () => {
  test("the sidebar groups the destinations and keeps Settings at the bottom", async ({
    page,
  }, testInfo) => {
    const m = MESSAGES[(testInfo.project.metadata as { locale: Locale }).locale];
    await page.setViewportSize({ width: 768, height: 600 });
    await page.goto("/dashboard");
    const nav = page.locator("aside nav");
    await expect(nav.locator("h2")).toHaveText([
      m.nav.groups.main,
      m.nav.groups.plan,
      m.nav.groups.debts,
      m.nav.groups.insights,
    ]);
    const hrefs = await nav.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual([
      "/dashboard",
      "/expenses",
      "/income",
      "/credit",
      "/recurring",
      "/goals",
      "/receivables",
      "/ledger",
      "/net-worth",
      "/settings",
    ]);
    // A short window: the navigation scrolls by itself and Settings stays reachable (SC-003).
    const settings = nav.locator('a[href="/settings"]');
    await settings.scrollIntoViewIfNeeded();
    await expect(settings).toBeInViewport();
  });

  test("every route marks exactly one destination as current", async ({ page }) => {
    test.setTimeout(90_000);
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.locator('aside nav [aria-current="page"]'), route).toHaveCount(1);
    }
  });

  test("＋ New is the only highlighted call to action and opens each dialog", async ({ page }) => {
    await page.goto("/net-worth");
    await expect(page.locator('[data-variant="cta"]:visible')).toHaveCount(1);
    await expect(page.getByTestId("new-menu")).toBeEnabled();
    await page.getByTestId("new-menu").click();
    const menu = page.getByRole("menu");
    for (const [id, key] of [
      ["new-expense", "N"],
      ["new-income", "I"],
    ] as const) {
      await expect(menu.getByTestId(id)).toContainText(key);
    }
    // Spec 011: no "Pay card" entry; cards are marked as paid from the card itself.
    await expect(menu.getByTestId("new-card-payment")).toHaveCount(0);
    await menu.getByTestId("new-income").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#income-amount")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("N and I open the dialogs, P doesn't; typing in a field doesn't", async ({ page }) => {
    await page.goto("/goals");
    await expect(page.getByTestId("new-menu")).toBeEnabled();
    for (const [key, field] of [
      ["n", "#expense-amount"],
      ["i", "#income-amount"],
    ] as const) {
      await page.keyboard.press(key);
      await expect(page.locator(field)).toBeVisible();
      // While the dialog is open the letters are just letters.
      await page.locator(field).press("n");
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    }
    await page.keyboard.press("Control+n").catch(() => {});
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.keyboard.press("p");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("a dialog doesn't survive navigating away", async ({ page }) => {
    await page.goto("/dashboard");
    await page.goto("/goals");
    await openCreate(page, "expense");
    await page.goBack();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Credit and Expenses show the same statement for every card, with one-tap actions", async ({
    page,
  }) => {
    await page.goto("/credit");
    const full = page.getByTestId("credit-card");
    await expect(full.first()).toBeVisible();
    const byCard = new Map<string, { amount: string; state: string | null }>();
    for (const card of await full.all()) {
      byCard.set((await card.getAttribute("data-card")) as string, {
        amount: await card.getByTestId("statement-amount").innerText(),
        state: await card.getAttribute("data-state"),
      });
    }

    await page.goto("/expenses");
    const compact = page.getByTestId("card-debt");
    await expect(compact).toHaveCount(byCard.size);
    for (const row of await compact.all()) {
      const expected = byCard.get((await row.getAttribute("data-card")) as string);
      expect(expected).toBeDefined();
      expect(await row.getByTestId("statement-amount").innerText()).toBe(expected?.amount);
      expect(await row.getAttribute("data-state")).toBe(expected?.state);
    }
    await expect(page.getByTestId("cards-see-credit")).toHaveAttribute("href", "/credit");

    // No amount form anywhere: "Ya la pagué" / "Desmarcar" act on the card itself (spec 011).
    await expect(page.getByTestId("pay-card")).toHaveCount(0);
    await expect(
      page.getByTestId("mark-paid").or(page.getByTestId("unmark-paid")).first(),
    ).toBeVisible();
  });

  test("page headers have an icon; Rules links back to Settings", async ({ page }, testInfo) => {
    const m = MESSAGES[(testInfo.project.metadata as { locale: Locale }).locale];
    for (const route of ["/settings", "/settings/rules", "/settings/accounts"]) {
      await page.goto(route);
      await expect(page.locator("main h1 svg"), route).toHaveCount(1);
    }
    await page.goto("/settings/rules");
    const back = page.getByTestId("page-back");
    await expect(back).toHaveText(m.settings.title);
    await back.click();
    await page.waitForURL(/\/settings$/);
  });
});

test.describe("Spec 008 · appearance panel", { tag: "@demo" }, () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("the top bar panel is called Appearance", async ({ page }, testInfo) => {
    const m = MESSAGES[(testInfo.project.metadata as { locale: Locale }).locale];
    await page.goto("/dashboard");
    await expect(page.getByTestId("preferences-open")).toHaveAttribute(
      "aria-label",
      m.nav.appearance,
    );
    await page.getByTestId("preferences-open").click();
    await expect(page.getByTestId("preferences-sheet").getByRole("heading")).toHaveText(
      m.nav.appearance,
    );
  });
});
