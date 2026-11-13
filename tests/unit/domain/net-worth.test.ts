/**
 * T140 · Net worth (FR-031, US10-4).
 *   assets      = Σ opening balances of non-card accounts + Σ allocations to Investment
 *               + Σ goal contributions from Needs/Wants + Σ third-party installments still owed
 *               + current available Needs and Wants (signed) + Saved total (spec 013)
 *   liabilities = Σ total card debt: what is recorded after the latest statement marked as paid
 *                 (spec 011), MSI installments included
 * The monthly snapshot is taken once per month (idempotent).
 */
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { computeNetWorth, dueNetWorthSnapshot } from "@/domain/net-worth";
import type { NetWorthSnapshot } from "@/domain/types";
import {
  d,
  emptySnapshot,
  makeAccount,
  makeAllocation,
  makeCard,
  makeExpense,
  makeGoal,
  makeInstallment,
  makeReceivable,
  testId,
} from "../../utils/fixtures";

const card = makeCard({ openingBalance: cents(99_999) }); // cards' opening balance isn't an asset
const goal = makeGoal({ sourceBucket: "needs" });
const receivable = makeReceivable({ cardAccountId: card.id, total: cents(400_000), termMonths: 2 });
const period = d("2026-11-01");

const snapshot = emptySnapshot({
  accounts: [
    makeAccount({ openingBalance: cents(1_000_000) }),
    makeAccount({ kind: "savings", openingBalance: cents(500_000) }),
    card,
  ],
  allocations: [
    makeAllocation({ bucket: "investment", amount: cents(300_000), periodStart: period }),
    makeAllocation({ bucket: "needs", amount: cents(500_000), periodStart: period }),
    makeAllocation({ bucket: "wants", amount: cents(200_000), periodStart: period }),
  ],
  expenses: [
    makeExpense({ amount: cents(120_000), spentOn: d("2026-11-03"), bucket: "needs" }),
    makeExpense({
      amount: cents(80_000),
      spentOn: d("2026-11-04"),
      bucket: "wants",
      paymentAccountId: card.id,
    }),
  ],
  statementMarks: [],
  receivables: [receivable],
  installments: [
    makeInstallment({
      receivableId: receivable.id,
      seq: 1,
      amount: cents(200_000),
      collected: cents(50_000),
      status: "partial",
    }),
    makeInstallment({
      receivableId: receivable.id,
      seq: 2,
      amount: cents(200_000),
      collected: cents(200_000),
      status: "collected",
    }),
  ],
  goals: [goal],
  contributions: [
    {
      id: testId(),
      goalId: goal.id,
      periodStart: period,
      amount: cents(100_000),
      sourceBucket: "needs",
    },
    {
      id: testId(),
      goalId: goal.id,
      periodStart: period,
      amount: cents(50_000),
      sourceBucket: "investment",
    },
  ],
});

describe("computeNetWorth", () => {
  it("adds every asset and subtracts the total card debt", () => {
    // assets: 1,500,000 opening + 300,000 investment + 100,000 contributions + 150,000 owed
    //         + needs available (500,000 − 120,000 − 100,000) + wants available (200,000 − 80,000)
    // liabilities: 80,000 purchases + 400,000 MSI (nothing marked as paid)
    expect(computeNetWorth(snapshot, d("2026-11-12"))).toEqual({
      assets: 2_450_000,
      liabilities: 480_000,
      netWorth: 1_970_000,
    });
  });

  it("marking a statement settles its purchases and installments, and only the liabilities move (FR-015, SC-006)", () => {
    const marked = {
      ...snapshot,
      statementMarks: [{ id: testId(), cardAccountId: card.id, cutOff: d("2026-11-10") }],
    };
    const before = computeNetWorth(snapshot, d("2026-11-12"));
    const after = computeNetWorth(marked, d("2026-11-12"));
    // Nov 10 statement (due Nov 30) covers the Nov 4 purchase and both installments due Nov 30.
    expect(after.liabilities).toBe(0);
    expect(after.assets).toBe(before.assets);
  });

  it("an overspent bucket lowers the assets (signed available)", () => {
    const overspent = {
      ...snapshot,
      expenses: [
        ...snapshot.expenses,
        makeExpense({ amount: cents(400_000), spentOn: d("2026-11-05"), bucket: "wants" }),
      ],
    };
    expect(computeNetWorth(overspent, d("2026-11-12")).assets).toBe(2_050_000);
  });

  it("is the same with saveSurplus on and off: Saved moves out of available into assets (spec 013)", () => {
    const twoSurpluses = {
      ...snapshot,
      allocations: [
        ...snapshot.allocations,
        makeAllocation({ bucket: "wants", amount: cents(70_000), periodStart: d("2026-10-16") }),
      ],
    };
    const on = { ...twoSurpluses, settings: { ...twoSurpluses.settings, saveSurplus: true } };
    const off = { ...twoSurpluses, settings: { ...twoSurpluses.settings, saveSurplus: false } };
    const asOf = d("2026-11-20");
    expect(computeNetWorth(on, asOf)).toEqual(computeNetWorth(off, asOf));
  });

  describe("Saved in goals (spec 014)", () => {
    const laptop = makeGoal({
      kind: "purchase",
      sourceBucket: "investment",
      annual: null,
      monthly: null,
      target: cents(2_500_000),
    });
    const withLaptop = { ...snapshot, goals: [...snapshot.goals, laptop] };
    const moves = (...amounts: number[]) =>
      amounts.map((amount) => ({
        id: testId(),
        goalId: laptop.id,
        movedOn: d("2026-11-12"),
        amount: cents(amount),
      }));
    const asOf = d("2026-11-12");

    it("assigning and returning don't change it (FR-012)", () => {
      const before = computeNetWorth(withLaptop, asOf);
      expect(computeNetWorth({ ...withLaptop, savedMoves: moves(500_000) }, asOf)).toEqual(before);
      expect(
        computeNetWorth({ ...withLaptop, savedMoves: moves(500_000, -200_000) }, asOf),
      ).toEqual(before);
    });

    it("'I bought it' lowers it by the goal's net from Saved; restoring gives it back (FR-018)", () => {
      const open = { ...withLaptop, savedMoves: moves(700_000, -200_000) };
      const bought = {
        ...open,
        goals: open.goals.map((g) =>
          g.id === laptop.id ? { ...g, archived: true, completed: true } : g,
        ),
      };
      const before = computeNetWorth(open, asOf);
      const after = computeNetWorth(bought, asOf);
      expect(before.assets - after.assets).toBe(500_000);
      expect(after.liabilities).toBe(before.liabilities);
    });
  });

  it("is zero for an empty snapshot", () => {
    expect(computeNetWorth(emptySnapshot(), d("2026-11-12"))).toEqual({
      assets: 0,
      liabilities: 0,
      netWorth: 0,
    });
  });
});

describe("dueNetWorthSnapshot", () => {
  const value = { assets: cents(10), liabilities: cents(4), netWorth: cents(6) };
  const existing = (on: string): NetWorthSnapshot => ({
    id: testId(),
    snapshotOn: d(on),
    ...value,
  });

  it("takes one snapshot per month, dated the 1st", () => {
    expect(dueNetWorthSnapshot([], value, d("2026-11-12"))).toEqual({
      snapshotOn: "2026-11-01",
      ...value,
    });
    expect(dueNetWorthSnapshot([existing("2026-10-01")], value, d("2026-11-12"))?.snapshotOn).toBe(
      "2026-11-01",
    );
  });

  it("does nothing if this month's snapshot exists", () => {
    expect(dueNetWorthSnapshot([existing("2026-11-01")], value, d("2026-11-30"))).toBeNull();
  });
});
