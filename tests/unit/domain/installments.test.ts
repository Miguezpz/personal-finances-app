/**
 * T095 · MSI purchases for third parties (US5, FR-022…FR-026): equal installments with the cents
 * remainder on the last one, a collection calendar always ahead of the card's due date, the
 * debtor's balance, and in-app alerts for overdue and next-7-days collections.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import {
  buildCollectionSchedule,
  COLLECTION_ALERT_WINDOW_DAYS,
  collectionAlerts,
  debtorBalance,
  splitInstallments,
} from "@/domain/installments";
import { cardStatus } from "@/domain/credit";
import { d, makeCard, makeInstallment, makeReceivable, testId } from "../../utils/fixtures";

// Cut-off on the 10th, payment due 20 days later.
const card = makeCard({ cutOffDay: 10, paymentDueOffsetDays: 20 });

describe("splitInstallments", () => {
  it("$12,000 at 6 months → six installments of $2,000 (US5-1)", () => {
    expect(splitInstallments(cents(1_200_000), 6)).toEqual(Array(6).fill(200_000));
  });

  it("puts the cents remainder on the last installment", () => {
    expect(splitInstallments(cents(100_000), 3)).toEqual([33_333, 33_333, 33_334]);
    expect(splitInstallments(cents(5), 4)).toEqual([1, 1, 1, 2]);
  });

  it("a 1-month term is the whole amount", () => {
    expect(splitInstallments(cents(99_999), 1)).toEqual([99_999]);
  });

  it("rejects terms outside 1–48 and non-positive totals", () => {
    expect(() => splitInstallments(cents(100), 0)).toThrow();
    expect(() => splitInstallments(cents(100), 49)).toThrow();
    expect(() => splitInstallments(cents(0), 3)).toThrow();
  });

  it("property: N installments that sum exactly to the total (SC-006)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 48 }),
        (total, n) => {
          const parts = splitInstallments(cents(total), n);
          expect(parts).toHaveLength(n);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          expect(new Set(parts.slice(0, -1)).size).toBeLessThanOrEqual(1);
        },
      ),
    );
  });
});

describe("buildCollectionSchedule", () => {
  it("bills the first installment on the statement that contains the purchase", () => {
    const s = buildCollectionSchedule(card, cents(1_200_000), 6, d("2026-11-05"), 3);
    expect(s.map((i) => i.cardDueOn)).toEqual([
      "2026-11-30",
      "2026-12-30",
      "2027-01-30",
      "2027-03-02", // Feb 10 + 20 days
      "2027-03-30",
      "2027-04-30",
    ]);
    expect(s[0]).toEqual({ seq: 1, dueOn: "2026-11-27", cardDueOn: "2026-11-30", amount: 200_000 });
  });

  it("a purchase on the cut-off day falls in that statement; the day after, in the next one", () => {
    expect(buildCollectionSchedule(card, cents(100), 1, d("2026-11-10"), 3)[0]?.cardDueOn).toBe(
      "2026-11-30",
    );
    expect(buildCollectionSchedule(card, cents(100), 1, d("2026-11-11"), 3)[0]?.cardDueOn).toBe(
      "2026-12-30",
    );
  });

  it("collects lead days before the card's due date (FR-024)", () => {
    const s = buildCollectionSchedule(card, cents(600_000), 3, d("2026-11-05"), 5);
    for (const i of s) {
      expect(i.dueOn < i.cardDueOn).toBe(true);
      expect(Date.parse(i.cardDueOn) - Date.parse(i.dueOn)).toBe(5 * 86_400_000);
    }
  });

  it("always collects at least one day early, even with 0 lead days", () => {
    const [first] = buildCollectionSchedule(card, cents(100), 1, d("2026-11-05"), 0);
    expect(first).toMatchObject({ cardDueOn: "2026-11-30", dueOn: "2026-11-29" });
  });

  it("clamps cut-off days in short months", () => {
    const eom = makeCard({ cutOffDay: 31, paymentDueOffsetDays: 10 });
    const s = buildCollectionSchedule(eom, cents(300), 3, d("2026-01-20"), 2);
    expect(s.map((i) => i.cardDueOn)).toEqual(["2026-02-10", "2026-03-10", "2026-04-10"]);
  });

  it("is consistent with how the card bills it (cardStatus)", () => {
    const receivable = makeReceivable({
      cardAccountId: card.id,
      total: cents(1_200_000),
      termMonths: 6,
      purchaseDate: d("2026-11-05"),
    });
    const installments = buildCollectionSchedule(
      card,
      receivable.total,
      6,
      receivable.purchaseDate,
      3,
    ).map((i) => makeInstallment({ ...i, receivableId: receivable.id }));
    const status = cardStatus(
      card,
      { expenses: [], cardPayments: [], receivables: [receivable], installments },
      d("2026-11-12"),
    );
    expect(status.payToAvoidInterest).toBe(200_000); // only the first installment is in this statement
    expect(status.totalDebt).toBe(1_200_000);
  });

  it("property: Σ amounts = total and dueOn < cardDueOn for every installment (SC-006)", () => {
    const dateArb = fc
      .date({
        min: new Date("2024-01-01T00:00:00Z"),
        max: new Date("2030-12-31T00:00:00Z"),
        noInvalidDate: true,
      })
      .map((dt) => d(dt.toISOString().slice(0, 10)));
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 31 }),
        fc.integer({ min: 1, max: 60 }),
        fc.integer({ min: 1, max: 100_000_000 }),
        fc.integer({ min: 1, max: 48 }),
        dateArb,
        fc.integer({ min: 0, max: 15 }),
        (cut, offset, total, n, purchase, lead) => {
          const c = makeCard({ cutOffDay: cut, paymentDueOffsetDays: offset });
          const s = buildCollectionSchedule(c, cents(total), n, purchase, lead);
          expect(s.reduce((a, i) => a + i.amount, 0)).toBe(total);
          expect(s.map((i) => i.seq)).toEqual(Array.from({ length: n }, (_, k) => k + 1));
          for (const i of s) expect(i.dueOn < i.cardDueOn).toBe(true);
          for (let k = 1; k < s.length; k++)
            expect(s[k]!.cardDueOn > s[k - 1]!.cardDueOn).toBe(true);
          expect(s[0]!.cardDueOn > purchase).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("debtorBalance", () => {
  it("sums what is still owed across all of the debtor's purchases (US5-7)", () => {
    const ana = testId();
    const r1 = makeReceivable({ debtorId: ana });
    const r2 = makeReceivable({ debtorId: ana });
    const other = makeReceivable({ debtorId: testId() });
    const installments = [
      makeInstallment({
        receivableId: r1.id,
        amount: cents(200_000),
        collected: cents(200_000),
        status: "collected",
      }),
      makeInstallment({
        receivableId: r1.id,
        amount: cents(200_000),
        collected: cents(50_000),
        status: "partial",
      }),
      makeInstallment({ receivableId: r2.id, amount: cents(100_000) }),
      makeInstallment({ receivableId: other.id, amount: cents(999_999) }),
    ];
    expect(debtorBalance(installments, [r1, r2, other], ana)).toBe(250_000);
  });
});

describe("collectionAlerts (FR-025)", () => {
  const ana = testId();
  const r = makeReceivable({ debtorId: ana });
  const at = (dueOn: string, extra: Partial<Parameters<typeof makeInstallment>[0]> = {}) =>
    makeInstallment({ receivableId: r.id, dueOn: d(dueOn), amount: cents(200_000), ...extra });

  it("uses a fixed 7-day window", () => {
    expect(COLLECTION_ALERT_WINDOW_DAYS).toBe(7);
  });

  it("alerts overdue and next-7-days collections, with what is still owed, soonest first", () => {
    const installments = [
      at("2026-11-17"), // in 7 days → alert
      at("2026-11-18"), // in 8 days → no alert
      at("2026-11-05"), // overdue → alert
      at("2026-11-10", { collected: cents(50_000), status: "partial" }), // today, partial
      at("2026-11-01", { collected: cents(200_000), status: "collected" }), // done → no alert
    ];
    const alerts = collectionAlerts(
      installments,
      [r],
      d("2026-11-10"),
      COLLECTION_ALERT_WINDOW_DAYS,
    );
    expect(alerts.map((a) => [a.dueOn, a.daysUntilDue, a.amountDue])).toEqual([
      ["2026-11-05", -5, 200_000],
      ["2026-11-10", 0, 150_000],
      ["2026-11-17", 7, 200_000],
    ]);
    expect(alerts.every((a) => a.debtorId === ana)).toBe(true);
  });
});
