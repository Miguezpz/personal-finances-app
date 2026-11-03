"use client";

/**
 * Ledger hooks (T125/T126): the unified ledger derived from the cached snapshot (no second
 * download, T158) and the display names used by the table and the CSV export.
 */
import { useCallback } from "react";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { CsvNames } from "@/domain/csv";
import { buildLedger } from "@/domain/ledger";
import type { FinanceSnapshot, Uuid } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";

const selectLedger = (s: FinanceSnapshot) => buildLedger(s);
const selectLookups = (s: FinanceSnapshot) => ({
  accounts: s.accounts,
  categories: s.categories,
  subcategories: s.subcategories,
});

export type LedgerLookups = ReturnType<typeof selectLookups>;

export function useLedger() {
  return useFinanceSnapshot(selectLedger);
}

export function useLedgerLookups() {
  return useFinanceSnapshot(selectLookups);
}

/** Account and subcategory names as shown in the UI (translated default subcategories). */
export function useCsvNames(): CsvNames {
  const nameOf = useTaxonomyName();
  const { data } = useLedgerLookups();
  const accountName = useCallback(
    (id: Uuid) => data?.accounts.find((a) => a.id === id)?.name ?? "",
    [data],
  );
  const subcategoryName = useCallback(
    (id: Uuid) => {
      const sub = data?.subcategories.find((x) => x.id === id);
      return sub ? nameOf(sub) : "";
    },
    [data, nameOf],
  );
  return { accountName, subcategoryName };
}
