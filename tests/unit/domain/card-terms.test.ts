/**
 * Spec 007 · Card terms from a statement, adjusted due dates and MSI rescheduling
 * (FR-002…FR-008, FR-011, research.md R2–R4/R7, data-model.md invariants).
 */
import { describe, expect, it } from "vitest";
import {
  cardTermsFromStatement,
  cardTermsOf,
  dueDateFor,
  installmentDatesFor,
  latestStatement,
  nominalDueDate,
  rescheduleCardInstallments,
  statementWarnings,
  upcomingStatements,
  type CardTerms,
} from "@/domain/card-terms";
import type { Cents } from "@/domain/types";
import { d, makeAccount, makeCard, makeInstallment, makeReceivable } from "../../utils/fixtures";

const REAL_CARDS: Array<[string, string, string, number, number]> = [
  ["BBVA", "2026-11-05", "2026-11-25", 5, 20],
  ["Banregio", "2026-10-14", "2026-11-04", 14, 21],
  ["DiDi", "2026-11-22", "2026-12-07", 22, 15],
  ["Nu", "2026-10-23", "2026-11-03", 23, 11],
  ["Plata", "2026-10-10", "2026-11-09", 10, 30],
  ["Mercado Pago", "2026-11-27", "2026-12-07", 27, 10],
];

const NU: CardTerms = { cutOffDay: 23, paymentDueOffsetDays: 11 };
const BBVA: CardTerms = { cutOffDay: 5, paymentDueOffsetDays: 20 };
const BANREGIO: CardTerms = { cutOffDay: 14, paymentDueOffsetDays: 21 };

describe("cardTermsFromStatement", () => {
  it.each(REAL_CARDS)("%s: %s → %s gives day %i, %i days", (_name, cut, due, day, offset) => {
    expect(cardTermsFromStatement(d(cut), d(due))).toEqual({
      ok: true,
      terms: { cutOffDay: day, paymentDueOffsetDays: offset },
    });
  });

  it("rejects a due date on or before the statement date", () => {
    expect(cardTermsFromStatement(d("2026-11-22"), d("2026-11-22"))).toEqual({
      ok: false,
      error: "dueNotAfterCutOff",
    });
    expect(cardTermsFromStatement(d("2026-11-22"), d("2026-11-01"))).toEqual({
      ok: false,
      error: "dueNotAfterCutOff",
    });
  });

  it("accepts 60 days and rejects 61", () => {
    expect(cardTermsFromStatement(d("2026-11-01"), d("2026-12-31"))).toMatchObject({ ok: true });
    expect(cardTermsFromStatement(d("2026-11-01"), d("2027-01-01"))).toEqual({
      ok: false,
      error: "dueTooFar",
    });
  });

  it("crosses into the next year", () => {
    expect(cardTermsFromStatement(d("2026-12-27"), d("2027-01-06"))).toEqual({
      ok: true,
      terms: { cutOffDay: 27, paymentDueOffsetDays: 10 },
    });
  });
});

describe("dueDateFor (adjusted to the previous business day)", () => {
  it.each([
    ["2026-06-23", "2026-07-03"], // Sat Jul 4 → Fri Jul 3
    ["2026-09-23", "2026-10-02"], // Sun Oct 4 → Fri Oct 2
    ["2026-10-23", "2026-11-03"], // Tue, unchanged
  ])("Nu, statement %s → %s", (cut, due) => {
    expect(dueDateFor(NU, d(cut))).toBe(due);
  });

  it("Banregio, Nov 14 + 21 = Sat Dec 5 → Fri Dec 4", () => {
    expect(nominalDueDate(BANREGIO, d("2026-11-14"))).toBe("2026-12-05");
    expect(dueDateFor(BANREGIO, d("2026-11-14"))).toBe("2026-12-04");
  });

  it("BBVA, Dec 5 + 20 = Dec 25 (holiday) → Thu Dec 24", () => {
    expect(dueDateFor(BBVA, d("2026-12-05"))).toBe("2026-12-24");
  });

  it("never falls on or before the statement date (invariant 2): uses the nominal date", () => {
    // Thu Dec 24 + 1 = Dec 25 (holiday); moving back would land on the statement date.
    expect(dueDateFor({ cutOffDay: 24, paymentDueOffsetDays: 1 }, d("2026-12-24"))).toBe(
      "2026-12-25",
    );
  });
});

describe("statementWarnings", () => {
  it("warns when the captured due date may have been moved (Nu Sep 23 → Mon Oct 5)", () => {
    expect(statementWarnings(d("2026-09-23"), d("2026-10-05"))).toEqual(["dueMayHaveMoved"]);
  });

  it("warns when the statement closed on the last day of a short month", () => {
    expect(statementWarnings(d("2027-02-28"), d("2027-03-17"))).toEqual(["shortMonthCutOff"]);
    expect(statementWarnings(d("2026-11-30"), d("2026-12-16"))).toEqual(["shortMonthCutOff"]);
  });

  it("says nothing for an ordinary statement (BBVA Nov 5 → Wed Nov 25)", () => {
    expect(statementWarnings(d("2026-11-05"), d("2026-11-25"))).toEqual([]);
    expect(statementWarnings(d("2026-10-31"), d("2026-11-18"))).toEqual([]);
  });
});

describe("upcomingStatements", () => {
  it("BBVA on Nov 7, 2026: the next 3 statements whose due date is today or later", () => {
    expect(upcomingStatements(BBVA, d("2026-11-07"))).toEqual([
      { cutOffOn: "2026-11-05", dueOn: "2026-11-25" },
      { cutOffOn: "2026-12-05", dueOn: "2026-12-24" },
      { cutOffOn: "2027-01-05", dueOn: "2027-01-25" },
    ]);
  });

  it("includes a statement due today and honours count", () => {
    expect(upcomingStatements(BBVA, d("2026-11-25"), 1)).toEqual([
      { cutOffOn: "2026-11-05", dueOn: "2026-11-25" },
    ]);
  });

  it("starts early enough for long offsets", () => {
    const plata = { cutOffDay: 10, paymentDueOffsetDays: 60 };
    expect(upcomingStatements(plata, d("2026-11-07"), 1)).toEqual([
      { cutOffOn: "2026-09-10", dueOn: "2026-11-09" },
    ]);
  });
});

describe("latestStatement", () => {
  it("is the last statement on or before today with its nominal due date", () => {
    expect(latestStatement(BBVA, d("2026-11-07"))).toEqual({
      cutOffOn: "2026-11-05",
      dueOn: "2026-11-25",
    });
    expect(latestStatement(BANREGIO, d("2026-11-07"))).toEqual({
      cutOffOn: "2026-10-14",
      dueOn: "2026-11-04",
    });
  });

  it.each(REAL_CARDS)("%s round-trips through cardTermsFromStatement (FR-005)", (...row) => {
    const terms = { cutOffDay: row[3], paymentDueOffsetDays: row[4] };
    const s = latestStatement(terms, d("2026-11-07"));
    expect(cardTermsFromStatement(s.cutOffOn, s.dueOn)).toEqual({ ok: true, terms });
  });

  it("picks a month long enough for days 29–31, so the round trip keeps the day", () => {
    const terms = { cutOffDay: 31, paymentDueOffsetDays: 20 };
    const s = latestStatement(terms, d("2026-12-15"));
    expect(s.cutOffOn).toBe("2026-10-31");
    expect(cardTermsFromStatement(s.cutOffOn, s.dueOn)).toEqual({ ok: true, terms });
  });
});

describe("cardTermsOf", () => {
  it("returns the terms of a configured card and null otherwise", () => {
    expect(cardTermsOf(makeCard({ cutOffDay: 5, paymentDueOffsetDays: 20 }))).toEqual(BBVA);
    expect(cardTermsOf(makeAccount({ kind: "checking" }))).toBeNull();
    expect(cardTermsOf(makeCard({ cutOffDay: null }))).toBeNull();
  });
});

describe("installmentDatesFor", () => {
  it("Banregio's pending installment: card due Dec 4, collect Dec 1 (lead 3)", () => {
    // Bought after the Oct 14 cut-off → first statement Nov 14.
    expect(installmentDatesFor(BANREGIO, d("2026-10-20"), 1, 3)).toEqual({
      cardDueOn: "2026-12-04",
      dueOn: "2026-12-01",
    });
  });

  it("uses at least one day of lead", () => {
    expect(installmentDatesFor(BANREGIO, d("2026-10-20"), 1, 0).dueOn).toBe("2026-12-03");
  });
});

describe("rescheduleCardInstallments", () => {
  const card = makeCard({ cutOffDay: 14, paymentDueOffsetDays: 21 });
  const other = makeCard({ cutOffDay: 1, paymentDueOffsetDays: 20 });
  const purchase = makeReceivable({
    cardAccountId: card.id,
    purchaseDate: d("2026-10-20"),
    termMonths: 3,
  });
  const otherPurchase = makeReceivable({ cardAccountId: other.id, purchaseDate: d("2026-10-20") });
  const old = { dueOn: d("2026-11-30"), cardDueOn: d("2026-12-03") };
  const first = makeInstallment({
    receivableId: purchase.id,
    seq: 1,
    ...old,
    collected: 200_000 as Cents,
    status: "collected",
  });
  const second = makeInstallment({
    receivableId: purchase.id,
    seq: 2,
    ...old,
    collected: 50_000 as Cents,
    status: "partial",
  });
  const third = makeInstallment({
    receivableId: purchase.id,
    seq: 3,
    dueOn: d("2027-02-01"),
    cardDueOn: d("2027-02-04"),
  });
  const foreign = makeInstallment({ receivableId: otherPurchase.id, seq: 1, ...old });
  const all = [first, second, third, foreign];

  it("returns only the not-collected installments of that card whose dates change", () => {
    expect(rescheduleCardInstallments(card, [purchase, otherPurchase], all, 3)).toEqual([
      // Dec 14 + 21 = Mon Jan 4, 2027.
      { id: second.id, cardDueOn: "2027-01-04", dueOn: "2027-01-01" },
    ]);
  });

  it("returns [] when everything is up to date", () => {
    const fixed = all.map((i) =>
      i.id === second.id ? { ...i, cardDueOn: d("2027-01-04"), dueOn: d("2027-01-01") } : i,
    );
    expect(rescheduleCardInstallments(card, [purchase, otherPurchase], fixed, 3)).toEqual([]);
  });

  it("returns [] for an account that is not a configured card", () => {
    expect(
      rescheduleCardInstallments(makeAccount({ kind: "checking" }), [purchase], all, 3),
    ).toEqual([]);
  });
});
