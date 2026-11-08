/** Spec 009 · FR-001: the last account and subcategory used, stored as identifiers only. */
import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_LAST_USED, sanitizeLastUsed, usePreferences } from "@/store/preferences";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("lastUsed", () => {
  beforeEach(() => usePreferences.setState({ lastUsed: EMPTY_LAST_USED }));

  it("merges a save without clearing the other fields", () => {
    usePreferences.getState().setLastUsed({ paymentAccountId: A, subcategoryId: B });
    usePreferences.getState().setLastUsed({ depositAccountId: A });
    expect(usePreferences.getState().lastUsed).toEqual({
      paymentAccountId: A,
      subcategoryId: B,
      depositAccountId: A,
      sourceAccountId: null,
    });
  });

  it("null clears a field (the form saved without an account)", () => {
    usePreferences.getState().setLastUsed({ paymentAccountId: A });
    usePreferences.getState().setLastUsed({ paymentAccountId: null });
    expect(usePreferences.getState().lastUsed.paymentAccountId).toBeNull();
  });

  it("ignores tampered or malformed storage field by field", () => {
    expect(sanitizeLastUsed({ paymentAccountId: "nope", subcategoryId: B, x: 1 })).toEqual({
      ...EMPTY_LAST_USED,
      subcategoryId: B,
    });
    expect(sanitizeLastUsed("garbage")).toEqual(EMPTY_LAST_USED);
  });
});
