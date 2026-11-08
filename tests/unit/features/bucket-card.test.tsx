/**
 * BucketCard: the Safe-to-Spend headline is never negative. An overspent bucket shows $0.00 and
 * "Over by $X" instead of "of $base"; a healthy one shows its balance against the base.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import type { BucketSafeToSpend } from "@/domain/safe-to-spend";
import { BucketCard } from "@/features/safe-to-spend/BucketCard";
import { renderWithProviders } from "../../utils/renderWithProviders";

const bucket = (available: number, base: number): BucketSafeToSpend => ({
  bucket: "needs",
  carryIn: cents(0),
  allocated: cents(base),
  fixedApplied: cents(0),
  fixedPending: cents(0),
  manual: cents(base - available),
  goalContributions: cents(0),
  available: cents(available),
  base: cents(base),
  ratio: null,
  light: available < 0 ? "red" : "green",
});

describe("BucketCard", () => {
  it("shows $0.00 and how much it went over when the bucket is overspent", () => {
    renderWithProviders(<BucketCard data={bucket(-675_450, 1_125_000)} />);
    const balance = screen.getByTestId("bucket-needs-balance");
    expect(balance.querySelector(".money")?.textContent).toBe("$0.00");
    expect(balance.textContent).not.toContain("-$");
    expect(screen.getByTestId("bucket-needs-over").textContent).toContain("$6,754.50");
  });

  it("shows the available balance against the base when there is money left", () => {
    renderWithProviders(<BucketCard data={bucket(500_000, 1_125_000)} />);
    const balance = screen.getByTestId("bucket-needs-balance");
    expect(balance.querySelector(".money")?.textContent).toBe("$5,000.00");
    expect(balance.textContent).toContain("$11,250.00");
    expect(screen.queryByTestId("bucket-needs-over")).toBeNull();
  });
});
