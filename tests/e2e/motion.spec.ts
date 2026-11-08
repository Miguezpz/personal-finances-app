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

  test("spec 010: navigating fades the new page in and the header stays still", async ({
    page,
  }) => {
    await page.goto("/expenses");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    const header = await page.locator("header").first().boundingBox();
    await page.locator('aside nav a[href="/goals"]').click();
    await page.waitForURL("**/goals");
    expect(
      await page
        .locator("main > div")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("page-in");
    expect(await page.locator("header").first().boundingBox()).toEqual(header);
  });

  test("spec 010: on mobile the header and the bottom bar never fade, move or get covered while navigating", async ({
    page,
  }) => {
    // A <ViewTransition> drew the pages in a layer above the shell: on iOS the bar vanished for a moment on every tap.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      const w = window as unknown as { __vt: number; __shell: string[] };
      w.__vt = 0;
      w.__shell = [];
      const start = document.startViewTransition?.bind(document);
      if (start)
        document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
          w.__vt++;
          return start(arg);
        }) as typeof document.startViewTransition;
      // Every frame: the header and the bar are fully opaque and not animating themselves.
      const sample = () => {
        for (const el of [
          document.querySelector("header"),
          document.querySelector("[data-testid=mobile-nav]"),
        ]) {
          if (!el) continue;
          const opacity = getComputedStyle(el).opacity;
          if (opacity !== "1" || el.getAnimations().length > 0)
            w.__shell.push(`${el.tagName} opacity=${opacity}`);
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto("/dashboard");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    const bar = await page.getByTestId("mobile-nav").boundingBox();

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.getByTestId("mobile-nav-expenses").click();
    await page.waitForURL("**/expenses");
    await page.getByTestId("mobile-nav-more").click();
    await page.getByTestId("more-sheet").locator('a[href="/goals"]').click();
    await page.waitForURL("**/goals");
    await page.waitForTimeout(300); // past the page's entrance

    const result = await page.evaluate(() => {
      const w = window as unknown as { __vt: number; __shell: string[] };
      return { vt: w.__vt, shell: w.__shell };
    });
    expect(result).toEqual({ vt: 0, shell: [] });
    expect(await page.getByTestId("mobile-nav").boundingBox()).toEqual(bar);
  });

  test("spec 010: goal bars grow with a transform (never width); the net-worth chart doesn't animate", async ({
    page,
  }) => {
    await page.goto("/goals");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    const fill = page.getByTestId("goal-progress-fill").first();
    await expect(fill).toBeVisible();
    const props = await fill.evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(props).toContain("transform");
    expect(props).not.toContain("width");
    await expect.poll(() => fill.getAttribute("style")).not.toContain("scaleX(0)");

    await page.goto("/net-worth");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    const chart = page.getByTestId("net-worth-chart");
    await expect(chart).toBeVisible();
    await page.waitForTimeout(350); // past the route transition and the reveal
    expect(
      await chart.evaluate(
        (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
      ),
    ).toBe(0);
  });

  test("spec 010: what replaces a skeleton fades in, and amounts stay masked meanwhile", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "pfa:prefs:v1",
        JSON.stringify({ state: { locale: "en", privacyMode: true }, version: 1 }),
      );
      // Record the reveal's Web Animations (useRevealOnLoad) and sample amounts while they run.
      const w = window as unknown as { __reveals: number; __leaks: number };
      w.__reveals = 0;
      w.__leaks = 0;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args: Parameters<typeof animate>) {
        if (this.closest("main")) {
          w.__reveals++;
          this.querySelectorAll(".money").forEach((el) => {
            if (el.getAttribute("data-masked") !== "true") w.__leaks++;
          });
        }
        return animate.apply(this, args);
      };
    });
    await page.goto("/expenses");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __reveals: number }).__reveals))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as unknown as { __leaks: number }).__leaks)).toBe(0);
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

test.describe("Spec 010 · bottom sheets on a phone", { tag: "@demo" }, () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  async function drag(page: Page, dy: number, steps: number) {
    const box = await page.getByTestId("create-sheet").getByTestId("sheet-handle").boundingBox();
    if (!box) throw new Error("no handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + dy, { steps });
    await page.mouse.up();
  }

  test("dragging the handle down closes the sheet; a short drag springs back", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    const sheet = page.getByTestId("create-sheet");

    await page.getByTestId("mobile-nav-create").click();
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(300); // let the slide-in finish
    await drag(page, 30, 15); // short and slow
    await page.waitForTimeout(300);
    await expect(sheet).toBeVisible();

    await drag(page, 140, 10);
    await expect(sheet).toBeHidden();
  });
});

test.describe("Spec 010 · polish on a phone", { tag: "@demo" }, () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("＋ rotates while its sheet is open; errors fade in; menu items and radios are 44 px", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
    const plus = page.getByTestId("mobile-nav-create").locator("svg");
    await page.getByTestId("mobile-nav-create").click();
    await expect.poll(() => plus.evaluate((el) => getComputedStyle(el).rotate)).toBe("45deg");

    // A validation error fades in.
    await page.getByTestId("create-income").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("save-income").click();
    const error = dialog.locator('[data-slot="field-error"]').first();
    await expect(error).toBeVisible();
    expect(await error.evaluate((el) => getComputedStyle(el).animationName)).toBe("field-error-in");
    // Radios get a 44 px touch area (16 px + 14 px on each side).
    const radio = dialog.locator('[data-slot="radio-group-item"]').first();
    expect(await radio.evaluate((el) => getComputedStyle(el, "::after").top)).toBe("-14px");
    await page.keyboard.press("Escape");

    // Menu items are at least 44 px tall on touch screens.
    await page.goto("/settings/quick-expenses");
    await page.getByTestId("template-menu").first().click();
    const item = page.getByRole("menuitem").first();
    const box = await item.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
