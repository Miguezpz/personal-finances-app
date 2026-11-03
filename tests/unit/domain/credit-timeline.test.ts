/**
 * T138 · Credit timeline (FR-028/029, US10-1/1a): paydays, card payment due dates and suggested
 * collections from debtors in one list ordered by date. Card events carry the "pay to avoid
 * interest" amount of that statement — never a minimum payment. The first upcoming statement
 * includes anything still unpaid; later ones only what they add.
 */
import { describe, expect, it } from "vitest";
import { creditTimeline } from "@/domain/credit";
import { cents } from "@/domain/money";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import {
  d,
  emptySnapshot,
  makeCard,
  makeExpense,
  makeInstallment,
  makeReceivable,
} from "../../utils/fixtures";

const card = makeCard({ name: "Gold Card", cutOffDay: 10, paymentDueOffsetDays: 20 });
const debtor = { id: "00000000-0000-4000-8000-00000000d0d0" as never, name: "Ana" };
const receivable = makeReceivable({
  debtorId: debtor.id,
  cardAccountId: card.id,
  total: cents(1_200_000),
  termMonths: 6,
  purchaseDate: d("2026-11-05"),
});
const inst = (seq: number, dueOn: string, cardDueOn: string, collected = 0) =>
  makeInstallment({
    receivableId: receivable.id,
    seq,
    dueOn: d(dueOn),
    cardDueOn: d(cardDueOn),
    amount: cents(200_000),
    collected: cents(collected),
    status: collected === 0 ? "pending" : collected < 200_000 ? "partial" : "collected",
  });

const snapshot = emptySnapshot({
  settings: { ...DEFAULT_USER_SETTINGS, firstPayday: 15, secondPayday: 31 },
  accounts: [card, makeCard({ name: "Old card", archived: true })],
  // $3,000 of direct purchases before the November cut-off (US10-1a).
  expenses: [
    makeExpense({ amount: cents(300_000), spentOn: d("2026-11-05"), paymentAccountId: card.id }),
  ],
  debtors: [debtor],
  receivables: [receivable],
  installments: [
    inst(1, "2026-11-27", "2026-11-30"),
    inst(2, "2026-12-27", "2026-12-30", 50_000),
    inst(3, "2027-01-27", "2027-01-30", 200_000),
  ],
});

describe("creditTimeline", () => {
  const events = creditTimeline(snapshot, d("2026-11-12"), d("2026-12-31"));

  it("lists paydays, card due dates and collections ordered by date", () => {
    expect(events.map((e) => [e.date, e.kind])).toEqual([
      ["2026-11-15", "payday"],
      ["2026-11-27", "collection_due"],
      ["2026-11-30", "payday"], // 31 → last day of November
      ["2026-11-30", "card_due"],
      ["2026-12-15", "payday"],
      ["2026-12-27", "collection_due"],
      ["2026-12-30", "card_due"],
      ["2026-12-31", "payday"],
    ]);
  });

  it("card events carry the amount to pay to avoid interest (US10-1a: $5,000)", () => {
    const november = events.find((e) => e.kind === "card_due" && e.date === "2026-11-30");
    expect(november).toMatchObject({ label: "Gold Card", amount: 500_000, refId: card.id });
    // A later statement shows only what it adds, assuming the earlier one is paid on time:
    // the second installment (no new purchases known yet). Otherwise the same debt would
    // appear twice on the timeline.
    const december = events.find((e) => e.kind === "card_due" && e.date === "2026-12-30");
    expect(december?.amount).toBe(200_000);
  });

  it("the first upcoming statement also carries any unpaid earlier one (overdue)", () => {
    // Seen from December 1st, November's $5,000 was never paid: December needs $7,000.
    const later = creditTimeline(snapshot, d("2026-12-01"), d("2026-12-31"));
    expect(later.find((e) => e.kind === "card_due")?.amount).toBe(700_000);
  });

  it("collections show what is still owed and who owes it; collected ones disappear", () => {
    const collections = events.filter((e) => e.kind === "collection_due");
    expect(collections.map((e) => [e.label, e.amount])).toEqual([
      ["Ana", 200_000],
      ["Ana", 150_000],
    ]);
  });

  it("skips archived cards, events outside the range and paydays have no amount", () => {
    expect(events.filter((e) => e.label === "Old card")).toEqual([]);
    expect(events.every((e) => e.date >= "2026-11-12" && e.date <= "2026-12-31")).toBe(true);
    expect(events.filter((e) => e.kind === "payday").every((e) => e.amount === null)).toBe(true);
    expect(creditTimeline(snapshot, d("2026-12-31"), d("2026-11-01"))).toEqual([]);
  });
});
