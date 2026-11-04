/**
 * 002-google-sign-in · T020 (live) + T024 (demo). The real Google screen needs real credentials and
 * is verified by hand (quickstart, scenario A); everything around it is covered here.
 */
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import type { Locale } from "../../src/domain/types";
import { APP_ROUTES } from "./app-routes";
import { expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const SUPABASE = /\.supabase\.(co|in|net)|:54321\b/;
const localeOf = (metadata: unknown) => (metadata as { locale: Locale }).locale;

test.describe("Google sign-in · live", { tag: "@live" }, () => {
  test("the landing offers Google above the password form, operable from the keyboard", async ({
    page,
  }, testInfo) => {
    const t = MESSAGES[localeOf(testInfo.project.metadata)].auth;
    await page.goto("/");

    const google = page.getByRole("button", { name: t.continueWithGoogle });
    await expect(google).toBeVisible();
    await expect(page.getByLabel(t.password)).toBeVisible(); // password fallback stays (FR-001)

    await google.focus();
    await expect(google).toBeFocused();
  });

  test("a Google account that isn't the owner's gets a clear message", async ({
    page,
  }, testInfo) => {
    const t = MESSAGES[localeOf(testInfo.project.metadata)].auth;
    await page.goto(
      "/auth/callback?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance",
    );

    await expect(page.getByRole("main").getByRole("alert")).toHaveText(t.googleNotAuthorized);
    await expect(page).toHaveURL(/\/$/); // URL cleaned: the message won't come back on reload
    await expect(page.getByText("Signups not allowed")).toHaveCount(0);
  });

  test("a callback without a code ends on the landing with the generic message", async ({
    page,
  }, testInfo) => {
    const t = MESSAGES[localeOf(testInfo.project.metadata)].auth;
    await page.goto("/auth/callback");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(t.googleFailed);
  });

  test("the callback never redirects outside the app", async ({ page, baseURL }) => {
    await page.goto("/auth/callback?next=https://example.com&redirect_to=https://example.com");
    expect(new URL(page.url()).origin).toBe(new URL(baseURL ?? "").origin);
  });
});

test.describe("Google sign-in · demo", { tag: "@demo" }, () => {
  test("no screen offers Google", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const t = MESSAGES[localeOf(testInfo.project.metadata)].auth;
    for (const route of APP_ROUTES) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText(t.continueWithGoogle)).toHaveCount(0);
    }
  });

  test("the callback goes to the dashboard without talking to Supabase", async ({ page }) => {
    const supabaseCalls: string[] = [];
    page.on("request", (r) => {
      if (SUPABASE.test(r.url())) supabaseCalls.push(r.url());
    });
    await page.goto("/auth/callback?code=whatever");
    await page.waitForURL("**/dashboard");
    expect(supabaseCalls).toEqual([]);
  });
});
