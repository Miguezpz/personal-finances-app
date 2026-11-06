/**
 * Payment-method options: grouped by kind with cash first (it was buried in an id-ordered list),
 * then cards, debit, savings and investment, sorted by name inside each group.
 */
import { describe, expect, it } from "vitest";
import type { Account } from "@/domain/types";
import { groupPaymentAccounts } from "@/features/settings/accounts/PaymentAccountOptions";

const acc = (kind: Account["kind"], name: string) => ({ kind, name });

describe("groupPaymentAccounts", () => {
  it("puts cash first, then cards, debit, savings and investment, each sorted by name", () => {
    const groups = groupPaymentAccounts(
      [
        acc("savings", "Stori Debit"),
        acc("credit_card", "Nu CC"),
        acc("investment", "GBM (Bolsa)"),
        acc("checking", "BBVA Débito"),
        acc("credit_card", "banregio CC"),
        acc("cash", "Efectivo"),
        acc("savings", "DiDi DC"),
      ],
      "es",
    );
    expect(groups.map((g) => [g.kind, g.accounts.map((a) => a.name)])).toEqual([
      ["cash", ["Efectivo"]],
      ["credit_card", ["banregio CC", "Nu CC"]],
      ["checking", ["BBVA Débito"]],
      ["savings", ["DiDi DC", "Stori Debit"]],
      ["investment", ["GBM (Bolsa)"]],
    ]);
  });

  it("omits empty groups", () => {
    expect(groupPaymentAccounts([acc("checking", "BBVA")], "en").map((g) => g.kind)).toEqual([
      "checking",
    ]);
  });
});
