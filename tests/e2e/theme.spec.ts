/**
 * Spec 003 · US3 dark theme (all four projects): no flash of the wrong theme (SC-004), the choice persists
 * (FR-016), "System" follows the OS live (FR-017) and an unreadable stored value falls back to the OS (FR-015).
 * Demo projects use /dashboard; live projects the landing page (no session needed — it has the same control).
 */
import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";

const DEEP = "rgb(3, 31, 29)"; // --brand-deep, dark background
const WHITE = "rgb(255, 255, 255)";
const ABYSS = "rgb(10, 10, 10)"; // --brand-abyss, neon background

const startPage = (testInfo: TestInfo) =>
  testInfo.project.metadata.mode === "demo" ? "/dashboard" : "/";

async function isDark(page: Page) {
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

async function isNeon(page: Page) {
  return page.evaluate(() => document.documentElement.classList.contains("neon"));
}

/** href of every tab icon (<link rel="icon">), in document order: the browser uses the last one. */
async function tabIcons(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('head link[rel~="icon"]')].map((l) => l.getAttribute("href")),
  );
}

async function pickTheme(page: Page, option: "light" | "dark" | "neon" | "system") {
  await page.getByTestId("theme-toggle").click();
  const item = page.getByTestId(`theme-option-${option}`);
  await item.click();
  await expect(item).toBeHidden();
}

test.describe("US3 · theme", () => {
  test("dark OS + nothing stored: the very first paint is already dark", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(startPage(testInfo), { waitUntil: "domcontentloaded" });
    // Before hydration (the boot skeleton is still up): set by the inline <head> script.
    expect(await isDark(page)).toBe(true);
    await expect(page.locator("body")).toHaveCSS("background-color", DEEP);
  });

  test("an explicit Light choice persists across reloads, even with a dark OS", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(startPage(testInfo));
    await expect(page.getByTestId("theme-toggle")).toBeVisible();
    expect(await isDark(page)).toBe(true);

    await pickTheme(page, "light");
    await expect.poll(() => isDark(page)).toBe(false);
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      "content",
      "#FFFFFF",
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await isDark(page)).toBe(false);
    await expect(page.locator("body")).toHaveCSS("background-color", WHITE);
  });

  test("Neon (a third, dark-based theme) applies, persists and survives a light OS", async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(startPage(testInfo));
    await expect(page.getByTestId("theme-toggle")).toBeVisible();

    await pickTheme(page, "neon");
    await expect.poll(() => isNeon(page)).toBe(true);
    expect(await isDark(page)).toBe(true); // dark: variants keep applying
    await expect(page.locator("body")).toHaveCSS("background-color", ABYSS);
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      "content",
      "#0A0A0A",
    );

    // The tab icon follows the theme too.
    await expect.poll(async () => (await tabIcons(page)).at(-1)).toBe("/icons/icon-neon.svg");
    expect((await page.request.get("/icons/icon-neon.svg")).ok()).toBe(true);

    // No flash on reload: the inline script applies it before hydration.
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await isNeon(page)).toBe(true);
    await expect(page.locator("body")).toHaveCSS("background-color", ABYSS);

    await expect.poll(async () => (await tabIcons(page)).at(-1)).toBe("/icons/icon-neon.svg");

    await pickTheme(page, "dark");
    await expect.poll(() => isNeon(page)).toBe(false);
    await expect(page.locator("body")).toHaveCSS("background-color", DEEP);
    await expect
      .poll(async () => (await tabIcons(page)).some((href) => href === "/icons/icon-neon.svg"))
      .toBe(false);
  });

  test("System follows OS changes live, without reloading", async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(startPage(testInfo));
    await pickTheme(page, "dark");
    await pickTheme(page, "system");
    expect(await isDark(page)).toBe(true);

    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => isDark(page)).toBe(false);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => isDark(page)).toBe(true);
  });

  test("an unknown stored theme falls back to the OS, without errors", async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "pfa:prefs:v1",
        JSON.stringify({ state: { locale: "en", theme: "sepia" }, version: 1 }),
      );
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(startPage(testInfo));
    await expect(page.getByTestId("theme-toggle")).toBeVisible();
    expect(await isDark(page)).toBe(true);
    expect(errors).toEqual([]);
  });
});
