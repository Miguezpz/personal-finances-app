/**
 * T152 · Accessibility audit (demo-en, demo-es): axe-core on every route — and on the open
 * dialogs of the main flows — with no serious or critical violations (WCAG 2.1 A/AA rules).
 * Keyboard reachability of the main flow is covered by perf-budgets (SC-002).
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { APP_ROUTES } from "./app-routes";
import { expect, openCreate, test } from "./fixtures";

async function audit(page: Page, where: string) {
  // Let enter transitions (dialogs, sheets) finish: axe would sample half-faded colors. Checked
  // twice, 150 ms apart: a lazily mounted dialog can start a transition (e.g. a button turning
  // enabled once its data is read) right after the first check.
  const settledAnimations = () =>
    page.waitForFunction(() =>
      document.getAnimations().every(
        (a) =>
          // Scroll-driven animations (the header title, spec 012) never finish: skip them.
          !(a.timeline instanceof DocumentTimeline) ||
          a.playState !== "running" ||
          a.effect?.getTiming().iterations === Infinity,
      ),
    );
  await settledAnimations();
  await page.waitForTimeout(150);
  await settledAnimations();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The Next.js dev-tools badge is not part of the app.
    .exclude("nextjs-portal")
    .analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    );
  expect(serious, `axe on ${where}`).toEqual([]);
}

/** Stores a theme before the app boots (the default is Neon; the light audits pin Light explicitly). */
async function useTheme(page: Page, theme: "light" | "dark" | "neon" | "system") {
  await page.addInitScript((stored) => {
    localStorage.setItem("pfa:prefs:v1", JSON.stringify({ state: { theme: stored }, version: 1 }));
  }, theme);
}

/** Opens a dialog, sheet or menu by test id; "create:<kind>" uses the app-wide create flow (spec 008). */
async function openPanel(page: Page, open: string) {
  if (open.startsWith("create:")) {
    await openCreate(page, open.slice("create:".length) as "expense" | "income");
    // The tap on the ＋ sheet's action leaves the pointer over whatever the dialog shows there
    // (a quick expense button): move it away so axe doesn't sample a hover transition.
    await page.mouse.move(0, 0);
    return;
  }
  if (open === "new-menu") {
    const trigger = page.getByTestId("new-menu");
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    return;
  }
  await page.getByTestId(open).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe("Accessibility", { tag: "@demo" }, () => {
  test.beforeEach(async ({ page }) => {
    await useTheme(page, "light");
  });

  test("every route has no serious or critical axe violations", async ({ page }) => {
    test.setTimeout(120_000);
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      await audit(page, route);
    }
  });

  test("main dialogs are accessible too", async ({ page }) => {
    test.setTimeout(60_000);
    for (const [route, open] of [
      ["/dashboard", "create:expense"],
      ["/income", "create:income"],
      ["/dashboard", "new-menu"],
      ["/recurring", "add-recurring"],
      ["/goals", "add-goal"],
    ] as const) {
      await page.goto(route);
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      await openPanel(page, open);
      await audit(page, `${route} ${open}`);
    }
  });

  test("spec 004: icons are decorative and every route passes axe in dark mode too", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await useTheme(page, "system"); // runs after the beforeEach's: the theme follows the emulated OS
    await page.emulateMedia({ colorScheme: "dark" });
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      await audit(page, `${route} (dark)`);
      // FR-016: every icon inside the page content is hidden from assistive technology, so it
      // never changes the accessible name of a button, badge or heading.
      const exposed = await page
        .locator("main svg.lucide:not([aria-hidden='true'])")
        .evaluateAll((svgs) => svgs.map((svg) => svg.outerHTML.slice(0, 120)));
      expect(exposed, `exposed icons on ${route}`).toEqual([]);
    }
    // The icon picker of the taxonomy editor, in both themes.
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/settings/categories");
      await page.getByTestId("icon-picker").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, `icon picker (${scheme})`);
      await page.keyboard.press("Escape");
    }
  });

  test("spec 005: the quick expense row, its ⋯ menu, the section and its dialogs, light and dark", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    for (const scheme of ["light", "dark"] as const) {
      await useTheme(page, scheme);
      const where = (what: string) => `${what} (${scheme})`;

      await page.goto("/dashboard");
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      const expenseDialog = await openCreate(page, "expense");
      await expect(expenseDialog.getByTestId("quick-expense-bar")).toBeVisible();
      await expenseDialog.locator('[data-testid^="quick-expense-menu-"]').first().click();
      await expect(page.getByRole("menu")).toBeVisible();
      await audit(page, where("quick expense menu"));

      await page.getByRole("menuitem").last().click();
      await expect(page.locator("#quick-expense-amount")).toBeVisible();
      await audit(page, where("another amount or date dialog"));
      await page.keyboard.press("Escape");

      await page.goto("/settings/quick-expenses");
      await expect(page.getByTestId("template-row").first()).toBeVisible();
      await audit(page, where("quick expenses section"));
      await page.getByTestId("template-menu").first().click();
      await page.getByTestId("template-edit").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, where("quick expense dialog"));
      await page.keyboard.press("Escape");
    }
  });

  test("keyboard: the first Tab offers to skip to the content, which then gets focus", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("bucket-needs")).toBeVisible();
    await page.waitForLoadState("networkidle");
    // `next dev` only: its dev-tools badge can take focus; it isn't part of the app (absent in
    // the production build CI tests).
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    await page.keyboard.press("Tab");
    const skip = page.getByTestId("skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
    // The next Tab lands inside the page content, not back in the header.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("main") !== null)).toBe(true);
  });
});

// Spec 003 · FR-038 / SC-002: the same audit on a phone viewport (bottom bar, ＋ sheet, More panel, bottom sheets).
test.describe("Accessibility · mobile", { tag: "@demo" }, () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test.beforeEach(async ({ page }) => {
    await useTheme(page, "light");
  });

  test("every route has no serious or critical axe violations", async ({ page }) => {
    test.setTimeout(120_000);
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      await audit(page, `${route} (mobile)`);
    }
  });

  test("main dialogs and panels are accessible too", async ({ page }) => {
    test.setTimeout(60_000);
    for (const [route, open] of [
      ["/dashboard", "mobile-nav-create"],
      ["/dashboard", "create:expense"],
      ["/dashboard", "preferences-open"],
      ["/dashboard", "mobile-nav-more"],
      ["/income", "create:income"],
      ["/recurring", "add-recurring"],
      ["/goals", "add-goal"],
    ] as const) {
      await page.goto(route);
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      await openPanel(page, open);
      await audit(page, `${route} ${open} (mobile)`);
    }
  });
});

// Spec 003 · FR-038 / SC-002: the same audit in the dark theme (desktop) — and in neon, the third (dark-based) theme.
for (const theme of ["dark", "neon"] as const) {
  test.describe(`Accessibility · ${theme} theme`, { tag: "@demo" }, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme);
    });

    test("every route has no serious or critical axe violations", async ({ page }) => {
      test.setTimeout(120_000);
      for (const route of APP_ROUTES) {
        await page.goto(route);
        await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
        expect(
          await page.evaluate((cls) => document.documentElement.classList.contains(cls), theme),
        ).toBe(true);
        await audit(page, `${route} (${theme})`);
      }
    });

    test("main dialogs are accessible too", async ({ page }) => {
      test.setTimeout(60_000);
      for (const [route, open] of [
        ["/dashboard", "create:expense"],
        ["/income", "create:income"],
        ["/dashboard", "new-menu"],
        ["/recurring", "add-recurring"],
        ["/goals", "add-goal"],
      ] as const) {
        await page.goto(route);
        await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
        await openPanel(page, open);
        await audit(page, `${route} ${open} (${theme})`);
      }
    });
  });
}
