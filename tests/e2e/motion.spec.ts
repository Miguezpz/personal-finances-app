/**
 * Spec 003 · US4 motion (demo-en, demo-es): with "reduce motion" nothing is still animating once a screen has loaded
 * (SC-005, FR-035); animations never delay the data (FR-034) and never reveal an amount with privacy on (FR-032).
 */
import type { Page } from "@playwright/test";
import { APP_ROUTES } from "./app-routes";
import { expect, test } from "./fixtures";

/** Running animations on app elements (the dev-tools badge lives in a shadow root and isn't part of the app). */
function runningAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && target.getRootNode() === document;
      })
      .map((a) => {
        const target = (a.effect as KeyframeEffect).target as Element;
        const name = "animationName" in a ? (a as CSSAnimation).animationName : a.constructor.name;
        return `${name} on <${target.tagName.toLowerCase()} class="${target.getAttribute("class")?.slice(0, 60)}">`;
      }),
  );
}

test.describe("US4 · motion", { tag: "@demo" }, () => {
  test("with reduced motion, no animation is left running after each screen loads", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
      await expect
        .poll(() => runningAnimations(page), { message: route, timeout: 1_000 })
        .toEqual([]);
    }
  });

  test("spec 008: with reduced motion the ＋ sheet and the More panel open without animating", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dashboard");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    for (const [open, panel] of [
      ["mobile-nav-create", "create-sheet"],
      ["mobile-nav-more", "more-sheet"],
    ] as const) {
      await page.getByTestId(open).click();
      await expect(page.getByTestId(panel)).toBeVisible();
      await expect
        .poll(() => runningAnimations(page), { message: panel, timeout: 1_000 })
        .toEqual([]);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId(panel)).toBeHidden();
    }
  });

  test("the staggered entrance never delays the balances", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    // In the DOM (and laid out) right away, whatever the entrance's opacity.
    await expect(page.getByTestId("bucket-needs").locator(".money").first()).toBeVisible({
      timeout: 1_000,
    });
    await expect(page.getByTestId("bucket-wants").locator(".money").first()).toBeVisible({
      timeout: 1_000,
    });
  });

  test("with privacy on, every amount stays masked during the entrance", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "pfa:prefs:v1",
        JSON.stringify({ state: { locale: "en", privacyMode: true }, version: 1 }),
      );
    });
    await page.goto("/dashboard");
    await page.getByTestId("bucket-needs").waitFor();
    // Sample every frame for 400 ms (longer than the whole entrance).
    const leaks = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let leaked = 0;
          const end = performance.now() + 400;
          const tick = () => {
            const money = document.querySelectorAll(".money");
            if (money.length === 0) leaked++;
            money.forEach((el) => {
              if (el.getAttribute("data-masked") !== "true") leaked++;
            });
            if (performance.now() < end) requestAnimationFrame(tick);
            else resolve(leaked);
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(leaks).toBe(0);
  });
});
