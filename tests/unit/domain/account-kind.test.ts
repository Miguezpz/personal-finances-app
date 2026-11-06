/**
 * Changing an account's kind: free while no recorded history depends on it; card payments / MSI
 * keep a card a card, income or card payments from it keep it from becoming a card, and a
 * distribution rule keeps an investment account an investment.
 */
import { describe, expect, it } from "vitest";
import { kindChangeBlocker } from "@/domain/account-kind";
import type { FinanceSnapshot, Uuid } from "@/domain/types";

const ID = "acc-1" as Uuid;
const empty = {
  cardPayments: [],
  receivables: [],
  incomes: [],
  allocations: [],
  rules: [],
} as unknown as Pick<
  FinanceSnapshot,
  "cardPayments" | "receivables" | "incomes" | "allocations" | "rules"
>;
const withData = (patch: Partial<Record<keyof typeof empty, unknown[]>>) =>
  ({ ...empty, ...patch }) as typeof empty;

describe("kindChangeBlocker", () => {
  it("allows any change when nothing depends on the kind", () => {
    expect(kindChangeBlocker({ id: ID, kind: "credit_card" }, "checking", empty)).toBeNull();
    expect(kindChangeBlocker({ id: ID, kind: "savings" }, "credit_card", empty)).toBeNull();
    expect(kindChangeBlocker({ id: ID, kind: "investment" }, "savings", empty)).toBeNull();
  });

  it("never blocks keeping the same kind", () => {
    const s = withData({ cardPayments: [{ cardAccountId: ID, fromAccountId: null }] });
    expect(kindChangeBlocker({ id: ID, kind: "credit_card" }, "credit_card", s)).toBeNull();
  });

  it("keeps a card with payments or MSI purchases a card", () => {
    const paid = withData({ cardPayments: [{ cardAccountId: ID, fromAccountId: null }] });
    const msi = withData({ receivables: [{ cardAccountId: ID }] });
    expect(kindChangeBlocker({ id: ID, kind: "credit_card" }, "checking", paid)).toBe(
      "cardHistory",
    );
    expect(kindChangeBlocker({ id: ID, kind: "credit_card" }, "cash", msi)).toBe("cardHistory");
  });

  it("keeps an account that held money from becoming a card", () => {
    const from = withData({ cardPayments: [{ cardAccountId: "other", fromAccountId: ID }] });
    const deposit = withData({ incomes: [{ depositAccountId: ID }] });
    const allocation = withData({ allocations: [{ accountId: ID }] });
    for (const s of [from, deposit, allocation]) {
      expect(kindChangeBlocker({ id: ID, kind: "checking" }, "credit_card", s)).toBe(
        "moneyHistory",
      );
    }
    // …but it can still become any other non-card kind.
    expect(kindChangeBlocker({ id: ID, kind: "checking" }, "savings", deposit)).toBeNull();
  });

  it("keeps an investment account used by a rule an investment", () => {
    const s = withData({ rules: [{ investmentSubrules: [{ accountId: ID, pct: 10000 }] }] });
    expect(kindChangeBlocker({ id: ID, kind: "investment" }, "savings", s)).toBe("investmentRules");
  });
});
