/**
 * Spec 007 · Card terms from a statement's dates (demo + live, EN/ES).
 *
 *  - Demo: editing a card prefills its latest statement and shows the next 3 statements; saving is
 *    refused read-only; axe finds no serious violations in the dialog.
 *  - Live: an MSI purchase whose not-collected installments have stale dates is fixed when the
 *    app opens (FR-013); changing the card's statement dates reschedules them in the same write
 *    and the collected one never moves (FR-011, US3).
 */
import AxeBuilder from "@axe-core/playwright";
import { ACCOUNTS, ACCOUNT_IDS } from "../../src/data/mock/fixtures/catalog";
import {
  cardTermsOf,
  installmentDatesFor,
  latestStatement,
  type CardTerms,
} from "../../src/domain/card-terms";
import { addDays } from "../../src/domain/dates";
import { todayIn } from "../../src/domain/periods";
import type { IsoDate, Locale } from "../../src/domain/types";
import en from "../../src/i18n/messages/en.json";
import es from "../../src/i18n/messages/es.json";
import { expect, test } from "./fixtures";

const MESSAGES = { en, es } as const;
const TZ = "America/Mexico_City";
const localeOf = (metadata: unknown) => (metadata as { locale: Locale }).locale;

test.describe("US14 · card statement dates in the demo", { tag: "@demo" }, () => {
  test("prefills the latest statement, previews 3 and refuses to save", async ({
    page,
  }, testInfo) => {
    const locale = localeOf(testInfo.project.metadata);
    const gold = ACCOUNTS.find((a) => a.id === ACCOUNT_IDS.goldCard);
    const terms = gold && cardTermsOf(gold);
    if (!terms) throw new Error("demo gold card missing");
    const latest = latestStatement(terms, todayIn(TZ, new Date()));

    await page.goto("/settings/accounts");
    const card = page.locator(`[data-testid="account-card"][data-id="${ACCOUNT_IDS.goldCard}"]`);
    await card.getByTestId("edit-account").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#card-statement-cutoff")).toHaveValue(latest.cutOffOn);
    await expect(dialog.locator("#card-statement-due")).toHaveValue(latest.dueOn);
    await expect(dialog.getByTestId("card-terms-summary")).toContainText(
      MESSAGES[locale].settings.cardTerms
        .replace("{day}", String(terms.cutOffDay))
        .replace("{offset}", String(terms.paymentDueOffsetDays)),
    );
    await expect(dialog.getByTestId("card-upcoming-statements").getByRole("listitem")).toHaveCount(
      3,
    );

    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== "running"),
    );
    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id),
    ).toEqual([]);

    await dialog.getByTestId("save-account").click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: MESSAGES[locale].common.demoReadOnly }),
    ).toHaveCount(1);
  });
});

test.describe("US14 · MSI installments follow the card", { tag: "@live" }, () => {
  test("stale dates are fixed on open and a terms change reschedules the pending ones", async ({
    ownerPage: page,
    admin,
    owner,
    userClient,
  }) => {
    test.setTimeout(90_000);
    const today = todayIn(TZ, new Date());
    const before: CardTerms = { cutOffDay: 15, paymentDueOffsetDays: 20 };
    const after: CardTerms = { cutOffDay: 14, paymentDueOffsetDays: 21 };
    const purchaseDate = addDays(today, -40);

    const { data: card } = await userClient
      .from("accounts")
      .insert({
        kind: "credit_card",
        name: "MSI Card",
        cut_off_day: 15,
        payment_due_offset_days: 20,
      })
      .select("id")
      .single();
    const cardId = card?.id as string;
    const { data: debtor } = await userClient
      .from("debtors")
      .insert({ name: "Ana" })
      .select("id")
      .single();
    const { data: settings } = await admin
      .from("user_settings")
      .select("collection_lead_days")
      .eq("user_id", owner.id)
      .maybeSingle();
    const lead = settings?.collection_lead_days ?? 3;

    // Dates one day off what the business-day rule gives (as if computed before spec 007).
    const correct = (terms: CardTerms, seq: number) =>
      installmentDatesFor(terms, purchaseDate, seq, lead);
    const stale = (seq: number) => {
      const c = correct(before, seq);
      return { due_on: addDays(c.dueOn, 1), card_due_on: addDays(c.cardDueOn, 1) };
    };
    const { error } = await userClient.rpc("create_receivable", {
      p_receivable: {
        debtor_id: debtor?.id,
        card_account_id: cardId,
        description: "Phone",
        total_cents: 300_000,
        term_months: 3,
        purchase_date: purchaseDate,
      },
      p_installments: [1, 2, 3].map((seq) => ({ seq, amount_cents: 100_000, ...stale(seq) })),
    });
    expect(error).toBeNull();
    const first = await admin
      .from("installments")
      .update({ collected_cents: 100_000, collected_on: today, status: "collected" })
      .eq("user_id", owner.id)
      .eq("seq", 1)
      .select("due_on, card_due_on")
      .single();
    const collected = first.data;

    const stored = async () => {
      const { data } = await admin
        .from("installments")
        .select("seq, due_on, card_due_on")
        .eq("user_id", owner.id)
        .order("seq");
      return data ?? [];
    };
    const expected = (terms: CardTerms) => [
      { seq: 1, ...collected },
      ...[2, 3].map((seq) => {
        const c = correct(terms, seq);
        return { seq, due_on: c.dueOn, card_due_on: c.cardDueOn };
      }),
    ];

    // --- Opening the app reschedules the stale, not-collected ones (FR-013) ------------------
    await page.goto("/receivables");
    await expect(page.getByTestId("installment-row")).toHaveCount(3);
    await expect.poll(stored).toEqual(expected(before));

    // --- Changing the statement dates reschedules them in the same write (FR-011) ------------
    await page.goto("/settings/accounts");
    await page
      .locator(`[data-testid="account-card"][data-id="${cardId}"]`)
      .getByTestId("edit-account")
      .click();
    const dialog = page.getByRole("dialog");
    const latest = latestStatement(after, today);
    await dialog.locator("#card-statement-cutoff").fill(latest.cutOffOn);
    await dialog.locator("#card-statement-due").fill(latest.dueOn as IsoDate);
    await dialog.getByTestId("save-account").click();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("accounts")
          .select("cut_off_day, payment_due_offset_days")
          .eq("id", cardId)
          .single();
        return data;
      })
      .toEqual({ cut_off_day: 14, payment_due_offset_days: 21 });
    await expect.poll(stored).toEqual(expected(after));
  });
});
