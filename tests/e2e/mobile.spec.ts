/**
 * Spec 003 · US2 one-handed mobile use (demo-en, demo-es): bottom navigation + "More" (FR-019), the floating
 * "Add expense" CTA as the only highlighted call to action (FR-006, FR-020, SC-007), compact header with the
 * preferences panel (FR-021), forms as bottom sheets with the numeric keyboard (FR-022, FR-025, SC-003), the ledger
 * as cards (FR-023), 44 px touch targets (FR-025) and no horizontal scroll from 320 px (FR-024).
 */
import type { Page } from "@playwright/test";
import { APP_ROUTES } from "./app-routes";
import { expect, test } from "./fixtures";

const PHONE = { width: 375, height: 812 };

async function settled(page: Page) {
  await expect(page.getByTestId("mobile-nav")).toBeVisible();
  await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
}

test.describe("US2 · mobile", { tag: "@demo" }, () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("bottom navigation: four destinations + More, with the active one marked", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const nav = page.getByTestId("mobile-nav");
    await expect(nav).toBeVisible();
    for (const id of ["dashboard", "expenses", "income", "goals", "more"]) {
      await expect(nav.getByTestId(`mobile-nav-${id}`)).toBeVisible();
    }
    await expect(nav.getByTestId("mobile-nav-dashboard")).toHaveAttribute("aria-current", "page");

    await nav.getByTestId("mobile-nav-expenses").click();
    await page.waitForURL("**/expenses");
    await expect(nav.getByTestId("mobile-nav-expenses")).toHaveAttribute("aria-current", "page");
    await expect(nav.getByTestId("mobile-nav-dashboard")).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    // "More" opens the remaining sections.
    await nav.getByTestId("mobile-nav-more").click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    for (const href of ["/recurring", "/receivables", "/credit", "/net-worth", "/ledger"]) {
      await expect(sheet.locator(`a[href="${href}"]`)).toBeVisible();
    }
    await sheet.locator('a[href="/ledger"]').click();
    await page.waitForURL("**/ledger");
    await expect(sheet).toBeHidden();
  });

  test("the floating CTA opens the expense form as a bottom sheet with a numeric keyboard", async ({
    page,
  }) => {
    await page.goto("/ledger");
    await settled(page);
    await page.getByTestId("fab-add-expense").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Anchored to the bottom edge (wait for the slide-in to finish).
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box ? Math.round(box.y + box.height) : 0;
      })
      .toBe(PHONE.height);
    await expect(dialog.locator("input[data-money]")).toHaveAttribute("inputmode", "decimal");
  });

  test("the floating CTA is the only highlighted call to action on every route", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await settled(page);
      const ctas = page.locator('[data-variant="cta"]:visible');
      await expect(ctas, route).toHaveCount(1);
      await expect(ctas.first(), route).toHaveAttribute("data-testid", "fab-add-expense");
      await expect(page.getByTestId("add-expense"), route).toBeHidden();
    }
  });

  test("the preferences panel groups language and currency", async ({ page }) => {
    await page.goto("/dashboard");
    await settled(page);
    // Inline toggles are desktop-only.
    await expect(page.getByTestId("language-toggle")).toBeHidden();

    await page.getByTestId("preferences-open").click();
    const sheet = page.getByTestId("preferences-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("language-toggle")).toBeVisible();
    await expect(sheet.getByTestId("currency-toggle")).toBeVisible();

    const target = (await page.locator("html").getAttribute("lang")) === "es" ? "en" : "es";
    await sheet.getByTestId("language-toggle").locator(`button[lang="${target}"]`).click();
    await expect(page.locator("html")).toHaveAttribute("lang", target);
  });

  test("the ledger shows stacked cards instead of the table", async ({ page }) => {
    await page.goto("/ledger");
    await settled(page);
    await expect(page.getByTestId("ledger-card").first()).toBeVisible();
    await expect(page.getByTestId("ledger-table")).toBeHidden();
  });

  test("every control in the bottom bar and the header is at least 44 × 44 px", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await settled(page);
    const controls = page.locator(
      [
        '[data-testid="mobile-nav"] a',
        '[data-testid="mobile-nav"] button',
        "header a:visible",
        "header button:visible",
      ].join(", "),
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const el = controls.nth(i);
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      const label = (await el.getAttribute("data-testid")) ?? (await el.innerText());
      expect(box?.width ?? 0, `width of ${label}`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `height of ${label}`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("US2 · no horizontal scroll", { tag: "@demo" }, () => {
  for (const viewport of [{ width: 320, height: 640 }, PHONE]) {
    test.describe(`${viewport.width} px`, () => {
      test.use({ viewport, hasTouch: true, isMobile: true });

      test("no route overflows horizontally", async ({ page }) => {
        test.setTimeout(90_000);
        for (const route of APP_ROUTES) {
          await page.goto(route);
          await settled(page);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(0);
        }
      });
    });
  }
});
