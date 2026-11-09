/**
 * Spec 003 · US2 one-handed mobile use, updated by spec 008 (demo-en, demo-es): bottom bar Home · Expenses · ＋ ·
 * Credit · More, "More" marked on secondary routes (spec 008 FR-003/FR-005), the "＋" as the only highlighted call to
 * action (FR-012), compact header with the appearance panel (FR-016), forms as bottom sheets with the numeric keyboard
 * (spec 003 FR-022, FR-025), the ledger as cards (FR-023), 44 px touch targets and no horizontal scroll from 320 px.
 */
import type { Page } from "@playwright/test";
import { APP_ROUTES } from "./app-routes";
import { expect, openCreate, test } from "./fixtures";

const PHONE = { width: 375, height: 812 };

async function settled(page: Page) {
  await expect(page.getByTestId("mobile-nav")).toBeVisible();
  await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
}

test.describe("US2 · mobile", { tag: "@demo" }, () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("bottom navigation: Home, Expenses, ＋, Credit and More, with the active one marked", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const nav = page.getByTestId("mobile-nav");
    await expect(nav).toBeVisible();
    await expect(nav.locator(":scope > div > ul > li")).toHaveCount(5);
    for (const id of ["dashboard", "expenses", "create", "credit", "more"]) {
      await expect(nav.getByTestId(`mobile-nav-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId("fab-add-expense")).toHaveCount(0);
    await expect(nav.getByTestId("mobile-nav-dashboard")).toHaveAttribute("aria-current", "page");

    await nav.getByTestId("mobile-nav-expenses").click();
    await page.waitForURL("**/expenses");
    await expect(nav.getByTestId("mobile-nav-expenses")).toHaveAttribute("aria-current", "page");
    await expect(nav.getByTestId("mobile-nav-dashboard")).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    // "More" slides up from the bottom with the remaining destinations, grouped.
    await nav.getByTestId("mobile-nav-more").click();
    const sheet = page.getByTestId("more-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("nav h2")).toHaveCount(4);
    for (const href of [
      "/income",
      "/recurring",
      "/goals",
      "/receivables",
      "/ledger",
      "/net-worth",
      "/settings",
    ]) {
      await expect(sheet.locator(`a[href="${href}"]`)).toBeVisible();
    }
    await expect(sheet.locator('a[href="/credit"]')).toHaveCount(0);
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return box ? Math.round(box.y + box.height) : 0;
      })
      .toBe(PHONE.height);
    await sheet.locator('a[href="/goals"]').click();
    await page.waitForURL("**/goals");
    await expect(sheet).toBeHidden();
    // A destination only "More" lists marks "More" as the current page.
    await expect(nav.getByTestId("mobile-nav-more")).toHaveAttribute("aria-current", "page");
  });

  test("＋ opens the create sheet; an action opens its form as a bottom sheet with a numeric keyboard", async ({
    page,
  }) => {
    await page.goto("/ledger");
    await settled(page);
    const plus = page.getByTestId("mobile-nav-create");
    await plus.click();
    const sheet = page.getByTestId("create-sheet");
    await expect(sheet).toBeVisible();
    await expect(plus).toHaveAttribute("aria-expanded", "true");
    for (const id of ["create-expense", "create-income"]) {
      await expect(sheet.getByTestId(id)).toBeVisible();
    }
    await sheet.getByTestId("create-income").click();
    await expect(sheet).toBeHidden();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("input[data-money]")).toHaveAttribute("inputmode", "decimal");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const expense = await openCreate(page, "expense");
    // Anchored to the bottom edge (wait for the slide-in to finish).
    await expect
      .poll(async () => {
        const box = await expense.boundingBox();
        return box ? Math.round(box.y + box.height) : 0;
      })
      .toBe(PHONE.height);
    await expect(expense.locator("input[data-money]")).toHaveAttribute("inputmode", "decimal");
  });

  test("＋ is the only highlighted call to action on every route", async ({ page }) => {
    test.setTimeout(90_000);
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await settled(page);
      const ctas = page.locator('[data-variant="cta"]:visible, [data-testid="mobile-nav-create"]');
      await expect(ctas, route).toHaveCount(1);
      await expect(page.getByTestId("new-menu"), route).toBeHidden();
    }
  });

  test("the Dashboard shows its alerts as a strip below the buckets", async ({ page }) => {
    await page.goto("/dashboard");
    await settled(page);
    const strip = page.getByTestId("dashboard-alert-strip");
    if ((await strip.count()) === 0) {
      // The demo seed may have no alert today; then nothing empty is rendered.
      await expect(page.getByTestId("collection-alerts")).toBeHidden();
      return;
    }
    const stripBox = await strip.boundingBox();
    const bucketBox = await page.getByTestId("bucket-needs").boundingBox();
    expect(stripBox?.y ?? 0).toBeGreaterThan(bucketBox?.y ?? 0);
    await strip.locator("a").first().click();
    await expect(page).toHaveURL(/\/(expenses|receivables)$/);
  });

  test("the appearance panel groups language and currency", async ({ page }) => {
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

// Spec 005 · SC-005: six quick expenses at 360 px scroll inside their own row, never the page,
// and every button is at least 44 px tall.
test.describe("Spec 005 · quick expense row on a phone", { tag: "@live" }, () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("six templates: the row scrolls by itself and its buttons are ≥ 44 px", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    let subcategoryId: string | undefined;
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("subcategories")
          .select("id")
          .eq("user_id", owner.id)
          .eq("name", "Public transport");
        subcategoryId = data?.[0]?.id;
        return subcategoryId;
      })
      .toBeTruthy();
    const names = ["Transporte", "Café de la mañana", "Comida", "Estacionamiento", "Metro", "Uber"];
    const { error } = await userClient.from("expense_templates").insert(
      names.map((name, sort) => ({
        name,
        amount_cents: 2400 + sort * 1000,
        sort,
        subcategory_id: subcategoryId as string,
      })),
    );
    expect(error).toBeNull();

    await page.goto("/dashboard");
    const bar = page.getByTestId("quick-expense-bar");
    await expect(bar.locator("li")).toHaveCount(6);
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);

    const overflow = await page.evaluate(
      () => (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
    );
    expect(overflow, "page horizontal overflow").toBeLessThanOrEqual(0);
    const row = await bar.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(row.scroll, "the row itself scrolls").toBeGreaterThan(row.client);

    const buttons = bar.locator("button");
    expect(await buttons.count()).toBe(12);
    for (let i = 0; i < 12; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box?.height ?? 0, `height of button ${i}`).toBeGreaterThanOrEqual(44);
    }
  });
});
