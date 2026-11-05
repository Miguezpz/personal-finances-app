/**
 * Spec 004 (T026, FR-008, Clarification B): the income type is mandatory in the form, has no
 * default, accepts only the 9 fixed values and reaches the provider input.
 */
import { describe, expect, it } from "vitest";
import { INCOME_TYPES } from "@/domain/income-types";
import { incomeFormSchema, type IncomeFormInput } from "@/features/income/schemas";

const valid: IncomeFormInput = {
  incomeType: "salary",
  label: "Salary",
  amount: "20,000",
  receivedOn: "2026-11-15",
  fundedPeriodStart: "2026-11-16",
  kind: "recurring",
  split: true,
  depositAccountId: "",
};

const messages = (input: IncomeFormInput) => {
  const r = incomeFormSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("incomeFormSchema · income type", () => {
  it("rejects an empty type with typeRequired", () => {
    expect(messages({ ...valid, incomeType: "" })).toContain("incomeType:typeRequired");
  });

  it("rejects a value outside the fixed list", () => {
    expect(messages({ ...valid, incomeType: "bonus" })).toContain("incomeType:typeRequired");
  });

  it.each(INCOME_TYPES)("accepts %s and passes it to the output", (type) => {
    const r = incomeFormSchema.safeParse({ ...valid, incomeType: type });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.incomeType).toBe(type);
  });

  it("keeps the rest of the output unchanged", () => {
    const r = incomeFormSchema.parse(valid);
    expect(r).toMatchObject({
      label: "Salary",
      amount: 2_000_000,
      isRecurring: true,
      distributed: true,
      depositAccountId: null,
      incomeType: "salary",
    });
  });
});
