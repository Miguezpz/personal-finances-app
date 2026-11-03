/**
 * Ledger filter form state (T125): what the controls hold (strings, "" = any) and its translation
 * to the domain `LedgerFilter`. A category expands to its subcategories.
 */
import { isIsoDate } from "@/domain/dates";
import type { LedgerFilter } from "@/domain/ledger";
import type { IsoDate, LedgerEntryType, Subcategory, Uuid } from "@/domain/types";

export const LEDGER_TYPES = [
  "income",
  "expense",
  "recurring_expense",
  "card_payment",
  "installment_collection",
] as const satisfies readonly LedgerEntryType[];

export type ThirdPartyFilter = "all" | "only" | "hide";

export interface LedgerFilterState {
  from: string;
  to: string;
  type: "" | LedgerEntryType;
  categoryId: string;
  accountId: string;
  thirdParty: ThirdPartyFilter;
}

export const EMPTY_LEDGER_FILTERS: LedgerFilterState = {
  from: "",
  to: "",
  type: "",
  categoryId: "",
  accountId: "",
  thirdParty: "all",
};

export function isFiltering(state: LedgerFilterState): boolean {
  return (Object.keys(EMPTY_LEDGER_FILTERS) as (keyof LedgerFilterState)[]).some(
    (k) => state[k] !== EMPTY_LEDGER_FILTERS[k],
  );
}

export function toLedgerFilter(
  state: LedgerFilterState,
  subcategories: readonly Pick<Subcategory, "id" | "categoryId">[],
): LedgerFilter {
  const filter: LedgerFilter = {};
  if (isIsoDate(state.from)) filter.from = state.from as IsoDate;
  if (isIsoDate(state.to)) filter.to = state.to as IsoDate;
  if (state.type) filter.types = [state.type];
  if (state.accountId) filter.accountId = state.accountId as Uuid;
  if (state.categoryId) {
    filter.subcategoryIds = subcategories
      .filter((x) => x.categoryId === state.categoryId)
      .map((x) => x.id);
  }
  if (state.thirdParty !== "all") filter.thirdParty = state.thirdParty === "only";
  return filter;
}
