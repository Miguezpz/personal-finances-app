/**
 * Spec 011 · US5: the monthly card payment session (FR-025–FR-030, contracts/domain.md).
 * Dates avoid weekends and Mexican bank holidays so due dates aren't moved (spec 007):
 *  - A: cut-off on the 9th + 21 days → Nov 9 → Mon Nov 30; pays Nov 10–29.
 *  - B: cut-off on the 25th + 19 days → Oct 25 → Fri Nov 13; pays Oct 26–Nov 12.
 *  - C: cut-off on the 28th + 7 days → Oct 28 → Wed Nov 4; pays Oct 29–Nov 3.
 */
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { nextPaymentSession, paymentSessions, sessionWindow } from "@/domain/payment-sessions";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type { Account, FinanceSnapshot } from "@/domain/types";
import { d, emptySnapshot, makeCard, makeExpense, makeMark } from "../../utils/fixtures";

const paydays = { firstPayday: 15, secondPayday: 31 };
const A = makeCard({ name: "A", cutOffDay: 9, paymentDueOffsetDays: 21 });
const B = makeCard({ name: "B", cutOffDay: 25, paymentDueOffsetDays: 19 });
const C = makeCard({ name: "C", cutOffDay: 28, paymentDueOffsetDays: 7 });
const buy = (card: Account, amount: number, on: string) =>
  makeExpense({ amount: cents(amount), spentOn: d(on), paymentAccountId: card.id });
const snap = (o: Partial<FinanceSnapshot> = {}) =>
  emptySnapshot({ settings: { ...DEFAULT_USER_SETTINGS, ...paydays }, ...o });
const names = (cards: readonly { card: Account }[]) => cards.map((c) => c.card.name);

describe("sessionWindow (FR-027)", () => {
  it.each([
    [
      "no payday in the cross → starts on its first day",
      "2026-11-10",
      "2026-11-12",
      "2026-11-10",
      "2026-11-12",
    ],
    ["payday with room → starts on it", "2026-11-13", "2026-11-20", "2026-11-15", "2026-11-17"],
    [
      "payday near the end → ends on the cross's last day",
      "2026-11-13",
      "2026-11-16",
      "2026-11-14",
      "2026-11-16",
    ],
    ["a 2-day cross → the whole cross", "2026-11-11", "2026-11-12", "2026-11-11", "2026-11-12"],
    ["a 1-day cross → that day", "2026-11-29", "2026-11-29", "2026-11-29", "2026-11-29"],
    ["31 = last day of the month", "2026-11-28", "2026-12-03", "2026-11-30", "2026-12-02"],
  ])("%s", (_name, from, to, start, end) => {
    expect(sessionWindow({ from: d(from), to: d(to) }, paydays)).toEqual({ start, end });
  });
});

describe("paymentSessions (FR-025, FR-026)", () => {
  it("the spec's example: two cards share Nov 10–12, so one 3-day session", () => {
    const s = snap({ accounts: [A, B] });
    const sessions = paymentSessions([A, B], s, s.settings, d("2026-11-05"));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      cross: { from: "2026-11-10", to: "2026-11-12" },
      window: { start: "2026-11-10", end: "2026-11-12" },
      phase: "upcoming",
    });
    expect(names(sessions[0]?.cards ?? [])).toEqual(["B", "A"]);
  });

  it("ranges that don't all overlap → the fewest sessions (3 cards → 2)", () => {
    const s = snap({ accounts: [A, B, C] });
    const sessions = paymentSessions([A, B, C], s, s.settings, d("2026-11-01"));
    expect(sessions.map((x) => names(x.cards))).toEqual([["C", "B"], ["A"]]);
    expect(sessions[0]?.cross).toEqual({ from: "2026-10-29", to: "2026-11-03" });
    expect(sessions[1]?.window).toEqual({ start: "2026-11-15", end: "2026-11-17" });
  });

  it("archived cards and cards without terms don't take part", () => {
    const archived = makeCard({ name: "Old", archived: true });
    const noTerms = makeCard({ name: "NoTerms", cutOffDay: null, paymentDueOffsetDays: null });
    const s = snap({ accounts: [A, archived, noTerms] });
    const sessions = paymentSessions([A, archived, noTerms], s, s.settings, d("2026-11-05"));
    expect(sessions.flatMap((x) => names(x.cards))).toEqual(["A"]);
  });

  it("is done when every card is marked as paid; the phase follows today", () => {
    const s = snap({
      accounts: [A, B],
      expenses: [buy(A, 1_000, "2026-11-02"), buy(B, 2_000, "2026-10-20")],
    });
    const pending = paymentSessions([A, B], s, s.settings, d("2026-11-11"))[0];
    expect(pending).toMatchObject({ done: false, phase: "today" });
    const marked = {
      ...s,
      statementMarks: [
        makeMark({ cardAccountId: A.id, cutOff: d("2026-11-09") }),
        makeMark({ cardAccountId: B.id, cutOff: d("2026-10-25") }),
      ],
    };
    expect(paymentSessions([A, B], marked, s.settings, d("2026-11-11"))[0]?.done).toBe(true);
  });
});

describe("nextPaymentSession (FR-028, FR-030)", () => {
  it("after a completed session, points to the next unfinished one", () => {
    const s = snap({
      accounts: [A, B],
      expenses: [buy(A, 1_000, "2026-11-02"), buy(A, 3_000, "2026-11-20")],
      statementMarks: [
        makeMark({ cardAccountId: A.id, cutOff: d("2026-11-09") }),
        makeMark({ cardAccountId: B.id, cutOff: d("2026-10-25") }),
      ],
    });
    const { current, next } = nextPaymentSession([A, B], s, s.settings, d("2026-11-11"));
    expect(current[0]?.done).toBe(true);
    expect(next).not.toBeNull();
    expect((next?.window.start ?? "") > (current[0]?.window.end ?? "")).toBe(true);
    expect(next?.cards.find((c) => c.card.id === A.id)?.statement.state).toBe("pending");
  });

  it("cards without recorded purchases still need checking off (the session isn't done)", () => {
    const s = snap({ accounts: [A, B] });
    const { next } = nextPaymentSession([A, B], s, s.settings, d("2026-11-05"));
    expect(next?.done).toBe(false);
    expect(next?.cards.map((c) => c.statement.state)).toEqual(["pending", "pending"]);
  });

  it("returns no next session when there are no cards", () => {
    const s = snap({ accounts: [] });
    expect(nextPaymentSession([], s, s.settings, d("2026-11-05")).next).toBeNull();
  });
});
