"use client";

/** Distribution rule hooks (T062): selector reads + optimistic writes over the snapshot. */
import type { NewEntity, SaveRuleInput } from "@/data/provider";
import { replaceTemp, useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { Account, DistributionRule, FinanceSnapshot } from "@/domain/types";

const selectRules = (s: FinanceSnapshot) => s.rules;
const selectInvestmentAccounts = (s: FinanceSnapshot) =>
  s.accounts.filter((a) => a.kind === "investment" && !a.archived);

export function useRules() {
  return useFinanceSnapshot(selectRules);
}

export function useInvestmentAccounts() {
  return useFinanceSnapshot(selectInvestmentAccounts);
}

export function useSaveRule() {
  return useSnapshotMutation<SaveRuleInput, DistributionRule>({
    mutationFn: (provider, input) => provider.rules.save(input),
    // Same effective date → replaced (only possible while unused); otherwise a new version.
    optimistic: (s, { rule }, { tempId }) => {
      const existing = s.rules.find((r) => r.effectiveFrom === rule.effectiveFrom);
      const saved: DistributionRule = { ...rule, id: existing?.id ?? tempId };
      return {
        ...s,
        rules: [...s.rules.filter((r) => r.effectiveFrom !== rule.effectiveFrom), saved].sort(
          (a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1),
        ),
      };
    },
    // One rule per effective date: the saved one replaces the optimistic one.
    created: (s, saved) => ({
      ...s,
      rules: s.rules.map((r) => (r.effectiveFrom === saved.effectiveFrom ? saved : r)),
    }),
  });
}

/** Quick-add of an investment vehicle from the rule form (full catalog management is US8). */
export function useCreateInvestmentAccount() {
  return useSnapshotMutation<string, Account>({
    mutationFn: (provider, name) => provider.accounts.create(newInvestmentAccount(name)),
    optimistic: (s, name, { tempId }) => ({
      ...s,
      accounts: [...s.accounts, { ...newInvestmentAccount(name), id: tempId }],
    }),
    created: (s, row, { tempId }) => ({ ...s, accounts: replaceTemp(s.accounts, tempId, row) }),
  });
}

function newInvestmentAccount(name: string): NewEntity<Account> {
  return {
    kind: "investment",
    name,
    institution: null,
    cutOffDay: null,
    paymentDueOffsetDays: null,
    openingBalance: 0 as Account["openingBalance"],
    archived: false,
  };
}
