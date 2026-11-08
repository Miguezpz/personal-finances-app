/**
 * T167 · The demo data obeys the same invariants as real data (checked with the domain itself),
 * on several "today"s, so recruiters never see an impossible state.
 */
import { describe, expect, it } from "vitest";
import { generateDemoSnapshot } from "@/data/mock/seed";
import { cardStatementSummary } from "@/domain/credit";
import { isCategoryIconKey } from "@/domain/icons";
import { isIncomeType } from "@/domain/income-types";
import { installmentStatusFor } from "@/domain/installments";
import { dueOccurrences } from "@/domain/recurring";
import type { IsoDate } from "@/domain/types";

const TODAYS = ["2026-01-01", "2026-02-28", "2026-07-15", "2026-11-03", "2026-12-31"] as IsoDate[];

describe.each(TODAYS)("demo snapshot for %s", (today) => {
  const s = generateDemoSnapshot({ today });

  it("allocations of every distributed income add up to it exactly", () => {
    for (const income of s.incomes.filter((i) => i.distributed)) {
      const sum = s.allocations
        .filter((a) => a.incomeId === income.id)
        .reduce((acc, a) => acc + a.amount, 0);
      expect(sum, income.id).toBe(income.amount);
    }
  });

  it("installments add up to each receivable, are suggested before the card's due date and have a coherent status", () => {
    for (const r of s.receivables) {
      const own = s.installments.filter((n) => n.receivableId === r.id);
      expect(own).toHaveLength(r.termMonths);
      expect(own.reduce((acc, n) => acc + n.amount, 0)).toBe(r.total);
    }
    for (const n of s.installments) {
      expect(n.dueOn < n.cardDueOn, n.id).toBe(true);
      expect(n.collected).toBeLessThanOrEqual(n.amount);
      expect(n.status).toBe(installmentStatusFor(n.collected, n.amount));
      if (n.collectedOn !== null) expect(n.collectedOn <= today).toBe(true);
    }
  });

  it("every due recurring charge is applied exactly once, and nothing is dated in the future", () => {
    expect(dueOccurrences(s.recurring, s.expenses, today)).toEqual([]);
    const keys = s.expenses
      .filter((e) => e.origin === "recurring")
      .map((e) => `${e.recurringExpenseId}|${e.occurrenceDate}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(s.expenses.every((e) => e.spentOn <= today)).toBe(true);
    expect(s.incomes.every((i) => i.receivedOn <= today)).toBe(true);
    expect(s.statementMarks.every((m) => m.cutOff <= today)).toBe(true);
    expect(s.contributions.every((c) => c.periodStart <= today)).toBe(true);
  });

  it("references resolve and net worth snapshots are internally consistent", () => {
    const ids = (xs: readonly { id: string }[]) => new Set(xs.map((x) => x.id));
    const accounts = ids(s.accounts);
    const subcategories = ids(s.subcategories);
    for (const e of s.expenses) {
      expect(subcategories.has(e.subcategoryId)).toBe(true);
      if (e.paymentAccountId) expect(accounts.has(e.paymentAccountId)).toBe(true);
    }
    const goals = ids(s.goals);
    expect(s.contributions.every((c) => goals.has(c.goalId))).toBe(true);
    for (const n of s.netWorthSnapshots) {
      expect(n.netWorth).toBe(n.assets - n.liabilities);
      expect(n.snapshotOn.endsWith("-01")).toBe(true);
    }
  });

  it("uses the owner's default taxonomy, with buckets inherited from each category (spec 004)", () => {
    expect(s.categories).toHaveLength(26);
    expect(s.subcategories).toHaveLength(68);
    expect(s.categories.every((c) => isCategoryIconKey(c.icon))).toBe(true);
    expect(s.subcategories.every((x) => x.icon === null && x.nameKey === null)).toBe(true);
    const macroOf = new Map(
      s.subcategories.map((x) => [x.id, s.categories.find((c) => c.id === x.categoryId)?.macro]),
    );
    for (const e of s.expenses) expect(e.bucket, e.id).toBe(macroOf.get(e.subcategoryId));
    for (const r of s.recurring) expect(r.bucket, r.name).toBe(macroOf.get(r.subcategoryId));
  });

  it("gives every income a valid type (spec 004)", () => {
    expect(s.incomes.every((i) => isIncomeType(i.incomeType))).toBe(true);
    expect(s.incomes.find((i) => i.label === "Salary")?.incomeType).toBe("salary");
  });
});

describe("demo statement marks (spec 011, FR-021)", () => {
  it("marks past statements and leaves a closed one pending on some day of the month", () => {
    const pendingSomewhere = ["2026-11-03", "2026-11-12", "2026-11-20", "2026-11-28"].some((t) => {
      const s = generateDemoSnapshot({ today: t as IsoDate });
      expect(s.statementMarks.length).toBeGreaterThan(0);
      return s.accounts
        .filter((a) => a.kind === "credit_card")
        .some((card) => {
          const state = cardStatementSummary(card, s, t as IsoDate).last.state;
          return state === "pending" || state === "overdue";
        });
    });
    expect(pendingSomewhere).toBe(true);
  });
});
