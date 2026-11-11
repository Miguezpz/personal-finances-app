/**
 * T148 · US10 with the demo's fictitious data (demo-en, demo-es): the credit page headlines the
 * amount to pay to avoid interest (never a minimum payment) and lines up due dates with paydays;
 * goals show the sinking fund's monthly hold-back and the emergency fund's progress; the net-worth
 * chart draws its three series and has a table view.
 */
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import type { Locale } from "../../src/domain/types";
import { expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;

test.describe("US10 · credit, goals and net worth", { tag: "@demo" }, () => {
  test("timeline, goals and net-worth history load with the demo data", async ({
    page,
  }, testInfo) => {
    const locale = (testInfo.project.metadata as { locale: Locale }).locale;
    const m = MESSAGES[locale];

    // --- Credit: pay-to-avoid-interest headline + the timeline -----------------------------
    await page.goto("/credit");
    const cards = page.getByTestId("credit-card");
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().getByTestId("last-statement")).toBeVisible();
    await expect(cards.first().getByTestId("next-statement")).toBeVisible();
    const timeline = page.getByTestId("credit-timeline");
    await expect(timeline.locator('[data-kind="payday"]').first()).toBeVisible();
    const due = timeline.locator('[data-kind="card_due"]');
    await expect(due.first()).toBeVisible();
    await expect(timeline.locator('[data-kind="collection_due"]').first()).toBeVisible();
    // Spec 008 · US3: a paid card leads with its next statement — the same as on the timeline;
    // an unpaid one leads with the amount to pay to avoid interest.
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const headline = card.getByTestId("statement-amount");
      if ((await card.getAttribute("data-state")) === "paid") {
        await expect(card).toContainText(m.credit.nextStatement);
        const name =
          (await card.locator("[data-slot=card-title]").innerText()).split("\n")[0] ?? "";
        // A statement already marked as paid shows "Paid" instead of an amount: skip those rows.
        const onTimeline = due
          .filter({ hasText: name.trim() })
          .filter({ has: page.locator(".money") })
          .first();
        if ((await onTimeline.count()) > 0)
          expect(await headline.innerText()).toBe(await onTimeline.locator(".money").innerText());
      } else {
        await expect(card).toContainText(m.credit.payToAvoidInterest);
      }
    }
    expect((await page.locator("main").innerText()).toLowerCase()).not.toMatch(
      locale === "en" ? /minimum payment/ : /pago mínimo/,
    );

    // --- Goals: sinking fund hold-back and emergency fund progress --------------------------
    await page.goto("/goals");
    const sinking = page.locator('[data-testid="goal-card"][data-kind="sinking_fund"]').first();
    await expect(sinking).toBeVisible();
    await expect(sinking.getByRole("progressbar")).toBeVisible();
    await expect(sinking.locator(".money")).not.toHaveCount(0);
    const fund = page.locator('[data-testid="goal-card"][data-kind="emergency_fund"]').first();
    await expect(fund.getByTestId("months-covered")).toBeVisible();

    // --- Net worth: three series over several months, plus a table view ---------------------
    await page.goto("/net-worth");
    const chart = page.getByTestId("net-worth-chart");
    await expect(chart.locator(".recharts-line")).toHaveCount(3);
    expect(
      await chart.locator(".recharts-xAxis-tick-labels .recharts-text").count(),
    ).toBeGreaterThan(1);
    await chart.getByText(m.netWorth.showTable).click();
    expect(await chart.locator("tbody tr").count()).toBeGreaterThan(1);
  });
});
