/**
 * T161 · Constitution quality gate across the four projects (demo-en, demo-es, live-en,
 * live-es): the P1 flows (dashboard and semáforo, income, recurring charges applied/pending) and
 * the global toggles (language, display currency, privacy). Every route is checked for
 * untranslated message keys, and nothing is readable with privacy on.
 * The live branch creates its data through the app; the demo reads the fictitious data.
 */
import type { Page, TestInfo } from "@playwright/test";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { todayIn } from "../../src/domain/periods";
import type { Locale } from "../../src/domain/types";
import { APP_ROUTES, READABLE_AMOUNT } from "./app-routes";
import { currentQuincena, expect, openCreate, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const TZ = "America/Mexico_City";
/** A next-intl key rendered instead of its text ("dashboard.title"). */
const RAW_KEY = new RegExp(`\\b(?:${Object.keys(en).join("|")})\\.[a-zA-Z]+`);

const localeOf = (testInfo: TestInfo) => (testInfo.project.metadata as { locale: Locale }).locale;

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" || /MISSING_MESSAGE/.test(m.text())) problems.push(m.text());
  });
  return problems;
}

async function settled(page: Page) {
  await expect(page.locator("main [aria-busy='true']")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

/** Semáforo: every bucket has a color AND a text label (never color alone). */
async function checkDashboard(page: Page, locale: Locale) {
  await page.goto("/dashboard");
  for (const bucket of ["needs", "wants"] as const) {
    const card = page.getByTestId(`bucket-${bucket}`);
    await expect(card).toHaveAttribute("data-light", /^(green|yellow|red|neutral)$/);
    const light = (await card.getAttribute("data-light")) as keyof typeof en.dashboard.light;
    await expect(card).toContainText(MESSAGES[locale].dashboard.light[light]);
  }
}

async function checkToggles(page: Page, locale: Locale) {
  const other: Locale = locale === "en" ? "es" : "en";
  await page.goto("/dashboard");
  await settled(page);

  // Language: in place, both ways.
  await page.getByTestId("language-toggle").locator(`button[lang="${other}"]`).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(MESSAGES[other].dashboard.title);
  await page.getByTestId("language-toggle").locator(`button[lang="${locale}"]`).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    MESSAGES[locale].dashboard.title,
  );

  // Display currency: USD amounts, or MXN with the fallback notice when no rate is available.
  const needs = page.getByTestId("bucket-needs").locator(".money").first();
  await page.getByTestId("currency-toggle").getByRole("button", { name: "USD" }).click();
  await expect(async () => {
    const shown = await needs.getAttribute("data-currency");
    const fallback = await page.getByTestId("fx-status").isVisible();
    expect(shown === "USD" || fallback).toBe(true);
  }).toPass();
  await page.getByTestId("currency-toggle").getByRole("button", { name: "MXN" }).click();
  await expect(needs).toHaveAttribute("data-currency", "MXN");

  // Privacy: nothing readable anywhere, then back.
  await page.getByTestId("privacy-toggle").click();
  for (const route of APP_ROUTES) {
    await page.goto(route);
    await settled(page);
    const text = await page.locator("body").innerText();
    expect(READABLE_AMOUNT.exec(text)?.[0] ?? null, `readable amount on ${route}`).toBeNull();
    expect(RAW_KEY.exec(text)?.[0] ?? null, `untranslated key on ${route}`).toBeNull();
  }
  await page.getByTestId("privacy-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-privacy", "off");
}

test.describe("Matrix · P1 flows and global toggles", () => {
  test(
    "demo: dashboard, income, recurring and toggles",
    { tag: "@demo" },
    async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const locale = localeOf(testInfo);
      const problems = watchConsole(page);

      await checkDashboard(page, locale);
      // Applied or still pending: on payday (and the day after) nothing has been charged yet.
      await expect(page.getByTestId("recurring-needs").locator("li").first()).toBeVisible();

      await page.goto("/income");
      await expect(page.getByTestId("income-card").first()).toBeVisible();

      await checkToggles(page, locale);
      expect(problems).toEqual([]);
    },
  );

  test(
    "live: register income, recurring applied/pending and toggles",
    { tag: "@live" },
    async ({ ownerPage: page, userClient, admin, owner }, testInfo) => {
      test.setTimeout(120_000);
      const locale = localeOf(testInfo);
      const today = todayIn(TZ, new Date());
      const period = currentQuincena(today);

      // A 50/50/0 rule effective before the quincena, and the default taxonomy (onboarding).
      await userClient.rpc("save_distribution_rule", {
        p_rule: {
          effective_from: period.from,
          needs_bps: 5000,
          wants_bps: 5000,
          investment_bps: 0,
        },
        p_subrules: [],
      });
      let rent: string | undefined;
      await expect
        .poll(async () => {
          const { data } = await admin
            .from("subcategories")
            .select("id")
            .eq("user_id", owner.id)
            // Default subcategories have no i18n key since spec 004: find "Rent" by name.
            .eq("name", "Rent");
          rent = data?.[0]?.id;
          return rent;
        })
        .toBeTruthy();

      // Recurring: one already charged this quincena, one still pending (when the quincena allows).
      // Charged on the payday (already applied) and on the last day (pending), by the real range.
      const startDay = Number(period.from.slice(8));
      const endDay = Number(period.to.slice(8));
      const pendingDay = period.to > today ? endDay : null;
      await userClient.from("recurring_expenses").insert([
        {
          name: "Rent",
          amount_cents: 100_000,
          charge_day: startDay,
          subcategory_id: rent as string,
          bucket: "needs",
          starts_on: period.from,
        },
        ...(pendingDay
          ? [
              {
                name: "Gym",
                amount_cents: 50_000,
                charge_day: pendingDay,
                subcategory_id: rent as string,
                bucket: "needs" as const,
                starts_on: period.from,
              },
            ]
          : []),
      ]);

      // P1: register an income through the app and read it back.
      await page.goto("/income");
      await openCreate(page, "income");
      // The income type is mandatory (spec 004).
      await page.getByTestId("income-type-salary").click();
      await page.locator("#income-label").fill("Salary");
      await page.locator("#income-amount").fill("20,000");
      await page.locator("#income-received").fill(period.from);
      await page.locator("#income-period").selectOption(period.start);
      await page.getByTestId("save-income").click();
      await expect(page.getByTestId("income-card").first()).toContainText("Salary");

      await checkDashboard(page, locale);
      const recurring = page.getByTestId("recurring-needs");
      await expect(recurring.locator('li[data-status="applied"]')).toHaveCount(1);
      if (pendingDay) await expect(recurring.locator('li[data-status="pending"]')).toHaveCount(1);

      const problems = watchConsole(page);
      await checkToggles(page, locale);
      expect(problems).toEqual([]);
    },
  );
});
