/**
 * Spec 011 · FR-018: an amount-based card payment from before spec 011 marks the statement it was
 * paying — the latest cut-off strictly before the payment date. Migration 0011 uses the same rule.
 */
import { describe, expect, it } from "vitest";
import { markForLegacyPayment } from "@/domain/legacy-card-payments";
import { d } from "../../utils/fixtures";

describe("markForLegacyPayment", () => {
  it.each([
    [10, "2026-11-12", "2026-11-10"], // paid two days after the cut-off → that statement
    [10, "2026-11-10", "2026-10-10"], // paid on the cut-off day → the previous statement
    [10, "2026-11-30", "2026-11-10"], // paid on the due date
    [31, "2026-03-05", "2026-02-28"], // cut-off on the 31st falls on Feb 28
    [10, "2027-01-01", "2026-12-10"], // crosses the year
  ])("cut-off day %d, paid on %s → statement of %s", (day, paidOn, expected) => {
    expect(markForLegacyPayment(day, d(paidOn))).toBe(expected);
  });
});
