/**
 * Ledger filter form state (T125): what the controls hold (strings, "" = any) and its translation
 * to the domain `LedgerFilter`. A category expands to its subcategories.
 */
import { isIsoDate } from "@/domain/dates";
import { isLedgerPreset, presetRange, type LedgerPreset } from "@/domain/ledger-presets";
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
  /** Text searched in descriptions and notes (spec 009, FR-022); ≤ 100 characters. */
  q: string;
  /** A date shortcut; "" when the range was typed (spec 009, FR-022). */
  preset: "" | LedgerPreset;
}

export const EMPTY_LEDGER_FILTERS: LedgerFilterState = {
  from: "",
  to: "",
  type: "",
  categoryId: "",
  accountId: "",
  thirdParty: "all",
  q: "",
  preset: "",
};

export const MAX_SEARCH_LENGTH = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THIRD_PARTY: readonly ThirdPartyFilter[] = ["all", "only", "hide"];

/** URL parameter of each filter (spec 009, FR-021). */
const PARAMS = {
  from: "desde",
  to: "hasta",
  type: "tipo",
  categoryId: "categoria",
  accountId: "cuenta",
  thirdParty: "terceros",
  q: "q",
  preset: "preset",
} as const satisfies Record<keyof LedgerFilterState, string>;

/** Filters from the URL; every invalid value falls back to its default. A preset wins over dates. */
export function filtersFromParams(
  params: Pick<URLSearchParams, "get">,
  today: IsoDate,
): LedgerFilterState {
  const get = (k: keyof LedgerFilterState) => params.get(PARAMS[k]) ?? "";
  const type = get("type");
  const thirdParty = get("thirdParty");
  const preset = get("preset");
  const state: LedgerFilterState = {
    from: isIsoDate(get("from")) ? get("from") : "",
    to: isIsoDate(get("to")) ? get("to") : "",
    type: (LEDGER_TYPES as readonly string[]).includes(type) ? (type as LedgerEntryType) : "",
    categoryId: UUID_RE.test(get("categoryId")) ? get("categoryId") : "",
    accountId: UUID_RE.test(get("accountId")) ? get("accountId") : "",
    thirdParty: (THIRD_PARTY as readonly string[]).includes(thirdParty)
      ? (thirdParty as ThirdPartyFilter)
      : "all",
    q: get("q").slice(0, MAX_SEARCH_LENGTH),
    preset: isLedgerPreset(preset) ? preset : "",
  };
  if (state.preset) Object.assign(state, presetRange(state.preset, today));
  return state;
}

/** The URL query for a filter state (defaults are left out; a preset replaces its dates). */
export function filtersToParams(state: LedgerFilterState): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(PARAMS) as (keyof LedgerFilterState)[]) {
    if (state.preset && (key === "from" || key === "to")) continue;
    const value = key === "q" ? state.q.trim().slice(0, MAX_SEARCH_LENGTH) : state[key];
    if (value !== EMPTY_LEDGER_FILTERS[key]) params.set(PARAMS[key], value);
  }
  return params;
}

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
