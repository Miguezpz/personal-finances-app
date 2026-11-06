/**
 * Spec 005 (T015, T024) · Quick expense form validation:
 *  - "another amount or date": amount > 0, no future date (FR-007a);
 *  - template form: trimmed name 1–40, amount > 0, subcategory required, optional payment method.
 */
import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/domain/types";
import {
  expenseTemplateFormSchema,
  makeQuickExpenseOverrideSchema,
  type ExpenseTemplateFormInput,
} from "@/features/expenses/template-schemas";

const today = "2026-11-05" as IsoDate;
const override = makeQuickExpenseOverrideSchema(today);
const overrideMessages = (input: { amount: string; spentOn: string }) => {
  const r = override.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("quickExpenseOverrideSchema", () => {
  it("accepts a positive amount today and converts it to cents", () => {
    expect(override.parse({ amount: "12", spentOn: "2026-11-05" })).toEqual({
      amount: 1200,
      spentOn: "2026-11-05",
    });
  });

  it.each(["0", "-1", "abc", ""])("rejects the amount %j with invalidAmount", (amount) => {
    expect(overrideMessages({ amount, spentOn: today })).toEqual(["invalidAmount"]);
  });

  it("rejects tomorrow with futureDate and accepts a past date", () => {
    expect(overrideMessages({ amount: "24", spentOn: "2026-11-06" })).toEqual(["futureDate"]);
    expect(overrideMessages({ amount: "24", spentOn: "2026-11-04" })).toEqual([]);
  });

  it("rejects an invalid date", () => {
    expect(overrideMessages({ amount: "24", spentOn: "2026-02-30" })).toContain("invalidDate");
  });
});

const valid: ExpenseTemplateFormInput = {
  name: "Transporte",
  amount: "24",
  subcategoryId: "00000000-0000-4000-8000-000000000001",
  paymentAccountId: "",
};
const templateMessages = (input: Partial<ExpenseTemplateFormInput>) => {
  const r = expenseTemplateFormSchema.safeParse({ ...valid, ...input });
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("expenseTemplateFormSchema", () => {
  it("returns typed domain values: cents, trimmed name and a null payment method", () => {
    expect(expenseTemplateFormSchema.parse({ ...valid, name: "  Transporte  " })).toEqual({
      name: "Transporte",
      amount: 2400,
      subcategoryId: valid.subcategoryId,
      paymentAccountId: null,
    });
  });

  it("keeps a chosen payment method", () => {
    const id = "00000000-0000-4000-8000-0000000000aa";
    expect(
      expenseTemplateFormSchema.parse({ ...valid, paymentAccountId: id }).paymentAccountId,
    ).toBe(id);
  });

  it("requires a name and caps it at 40 characters", () => {
    expect(templateMessages({ name: "  " })).toEqual(["nameRequired"]);
    expect(templateMessages({ name: "x".repeat(41) })).toEqual(["nameTooLong"]);
    expect(templateMessages({ name: "x".repeat(40) })).toEqual([]);
  });

  it("rejects a zero amount and a missing subcategory", () => {
    expect(templateMessages({ amount: "0" })).toEqual(["invalidAmount"]);
    expect(templateMessages({ subcategoryId: "" })).toEqual(["subcategoryRequired"]);
  });
});
