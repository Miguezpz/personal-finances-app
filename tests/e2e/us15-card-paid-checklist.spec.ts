/**
 * Spec 011 · "Ya la pagué" checklist and the monthly payment session (demo + live, EN/ES).
 *
 *  - Demo: Credit shows the payment session and one-tap "Ya la pagué" (no "Pay", no amount form);
 *    tapping it is refused read-only and nothing changes; the ＋ sheet has no "Pay card"; with the
 *    clock inside the session window the Dashboard shows "Time to pay your cards" instead of one
 *    alert per card; axe finds no serious violations on Credit.
 *  - Live: marking a closed statement flips it to paid at once; Undo brings it back; "Unmark"
 *    reopens it; the Safe-to-Spend never moves (SC-006).
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { generateDemoSnapshot } from "../../src/data/mock/seed";
import { parseIsoDate } from "../../src/domain/dates";
import { nextPaymentSession } from "../../src/domain/payment-sessions";
import { todayIn } from "../../src/domain/periods";
import type { IsoDate, Locale } from "../../src/domain/types";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const TZ = "America/Mexico_City";
const localeOf = (metadata: unknown) => (metadata as { locale: Locale }).locale;
const settled = (page: Page) => expect(page.locator("main [aria-busy='true']")).toHaveCount(0);

test.describe("US15 · paid checklist in the demo", { tag: "@demo" }, () => {
  test("Credit shows the session and 'Ya la pagué'; tapping it is read-only", async ({
    page,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)];
    await page.goto("/credit");
    await settled(page);

    const session = page.getByTestId("payment-session");
    await expect(session).toBeVisible();
    await expect(session).toContainText(m.credit.sessionTitle);
    await expect(session.getByTestId("session-card").first()).toBeVisible();
    await expect(page.getByTestId("pay-card")).toHaveCount(0);

    const card = page.locator('[data-testid="credit-card"][data-state="pending"]').first();
    await expect(card).toBeVisible();
    await card.getByTestId("mark-paid").click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: m.common.demoReadOnly }),
    ).toHaveCount(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card).toHaveAttribute("data-state", "pending");

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  test("the ＋ sheet has no 'Pay card' and P opens nothing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await settled(page);
    await page.getByTestId("mobile-nav-create").click();
    const sheet = page.getByTestId("create-sheet");
    await expect(sheet.getByTestId("create-expense")).toBeVisible();
    await expect(sheet.getByTestId("create-card-payment")).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press("p");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("inside the session window the Dashboard says it's time to pay", async ({
    page,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)];
    // A day inside the next session's window, computed with the same domain as the app.
    const base = todayIn(TZ, new Date());
    const seed = generateDemoSnapshot({ today: base });
    const next = nextPaymentSession(seed.accounts, seed, seed.settings, base).next;
    test.skip(!next, "no pending session in the demo data for the coming cycles");
    const day = next?.window.start as IsoDate;
    const atDay = generateDemoSnapshot({ today: day });
    const expected = nextPaymentSession(atDay.accounts, atDay, atDay.settings, day).next;
    test.skip(expected?.phase !== "today", "the demo marks every card before its window starts");

    const { year, month, day: dd } = parseIsoDate(day);
    await page.clock.install({ time: new Date(Date.UTC(year, month - 1, dd, 18)) }); // noon in CDMX
    await page.goto("/dashboard");
    await settled(page);

    const alert = page.locator('[data-testid="session-alert"]:visible');
    await expect(alert).toHaveAttribute("data-phase", "today");
    await expect(alert).toContainText(m.dashboard.sessionToday);
    const pending = (expected?.cards ?? []).filter(
      (c) => c.statement.state === "pending" || c.statement.state === "overdue",
    );
    for (const c of pending) {
      await expect(
        alert.locator(`[data-testid="session-card"][data-card="${c.card.id}"]`),
      ).toBeVisible();
      if (c.statement.state === "pending")
        await expect(
          page.locator(`[data-testid="card-due-alert"][data-card="${c.card.id}"]`),
        ).toHaveCount(0);
    }
  });
});

test.describe("US15 · paid checklist (live)", { tag: "@live" }, () => {
  test("mark → Undo → mark → Unmark, and the Safe-to-Spend never moves", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }, testInfo) => {
    const m = MESSAGES[localeOf(testInfo.project.metadata)];
    const today = todayIn(TZ, new Date());
    // The statement closes today: a purchase today lands on a closed, markable statement.
    const { data: card } = await userClient
      .from("accounts")
      .insert({
        kind: "credit_card",
        name: "Checklist Card",
        cut_off_day: parseIsoDate(today).day,
        payment_due_offset_days: 20,
      })
      .select("id")
      .single();
    const cardId = card?.id as string;
    let sub: string | undefined;
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("subcategories")
          .select("id")
          .eq("user_id", owner.id)
          .eq("name", "Restaurants");
        sub = data?.[0]?.id;
        return sub;
      })
      .toBeTruthy();
    await userClient.from("expenses").insert({
      amount_cents: 45_000,
      spent_on: today,
      subcategory_id: sub as string,
      bucket: "wants",
      payment_account_id: cardId,
    });

    await page.goto("/dashboard");
    await settled(page);
    const balance = await page.getByTestId("bucket-wants").locator(".money").first().innerText();

    await page.goto("/credit");
    await settled(page);
    const statement = page.locator(`[data-testid="credit-card"][data-card="${cardId}"]`);
    await expect(statement).toHaveAttribute("data-state", "pending");

    await statement.getByTestId("mark-paid").click();
    await expect(statement).toHaveAttribute("data-state", "paid");
    const marked = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: m.credit.marked.replace("{card}", "Checklist Card") });
    await marked.getByRole("button").click();
    await expect(statement).toHaveAttribute("data-state", "pending");
    await expect
      .poll(
        async () =>
          (await admin.from("card_statement_marks").select("id").eq("user_id", owner.id)).data,
      )
      .toEqual([]);

    await statement.getByTestId("mark-paid").click();
    await expect(statement).toHaveAttribute("data-state", "paid");
    await expect(statement.getByTestId("unmark-paid")).toBeVisible();
    await statement.getByTestId("unmark-paid").click();
    await expect(statement).toHaveAttribute("data-state", "pending");

    await page.goto("/dashboard");
    await settled(page);
    await expect(page.getByTestId("bucket-wants").locator(".money").first()).toHaveText(balance);
  });
});
