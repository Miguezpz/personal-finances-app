/** Spec 009 · FR-021: Ledger filters round-trip through the URL; invalid values are ignored. */
import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER_FILTERS,
  filtersFromParams,
  filtersToParams,
  type LedgerFilterState,
} from "@/features/ledger/filters";
import { d } from "../../utils/fixtures";

const TODAY = d("2026-11-07");
const ACCOUNT = "11111111-1111-4111-8111-111111111111";

describe("ledger filters in the URL", () => {
  it("round-trips a full state", () => {
    const state: LedgerFilterState = {
      ...EMPTY_LEDGER_FILTERS,
      from: "2026-10-01",
      to: "2026-10-31",
      type: "expense",
      accountId: ACCOUNT,
      thirdParty: "hide",
      q: "uber",
    };
    expect(filtersFromParams(filtersToParams(state), TODAY)).toEqual(state);
  });

  it("a preset sets its dates and keeps them out of the URL", () => {
    const params = filtersToParams({ ...EMPTY_LEDGER_FILTERS, preset: "last-month" });
    expect(params.toString()).toBe("preset=last-month");
    expect(filtersFromParams(params, TODAY)).toMatchObject({
      preset: "last-month",
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("ignores invalid values", () => {
    const params = new URLSearchParams(
      "desde=yesterday&tipo=bogus&cuenta=1&terceros=maybe&preset=forever&q=" + "x".repeat(150),
    );
    const state = filtersFromParams(params, TODAY);
    expect(state).toEqual({ ...EMPTY_LEDGER_FILTERS, q: "x".repeat(100) });
  });

  it("defaults produce an empty query", () => {
    expect(filtersToParams(EMPTY_LEDGER_FILTERS).toString()).toBe("");
  });
});
