/**
 * T088 · Expense form validation (US4-3, FR-013): amount > 0 (empty, 0 and negatives rejected),
 * note ≤ 200 characters, date and subcategory required; the payment method is optional.
 */
import { describe, expect, it } from "vitest";
import { expenseFormSchema, type ExpenseFormInput } from "@/features/expenses/schemas";

const valid: ExpenseFormInput = {
  amount: "250.50",
  spentOn: "2026-11-02",
  subcategoryId: "00000000-0000-4000-8000-000000000001",
  paymentAccountId: "",
  note: "",
};

const messages = (input: Partial<ExpenseFormInput>) => {
  const r = expenseFormSchema.safeParse({ ...valid, ...input });
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("expenseFormSchema", () => {
  it("accepts a valid expense and converts it to domain values", () => {
    const r = expenseFormSchema.safeParse({
      ...valid,
      paymentAccountId: "00000000-0000-4000-8000-0000000000aa",
      note: "  Lunch  ",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toEqual({
      amount: 25_050,
      spentOn: "2026-11-02",
      subcategoryId: valid.subcategoryId,
      paymentAccountId: "00000000-0000-4000-8000-0000000000aa",
      note: "Lunch",
    });
  });

  it("maps an empty payment method and note to null", () => {
    const r = expenseFormSchema.safeParse(valid);
    expect(r.success && r.data.paymentAccountId).toBeNull();
    expect(r.success && r.data.note).toBeNull();
  });

  it.each([[""], ["0"], ["0.00"], ["-5"], ["abc"]])("rejects the amount %j (US4-3)", (amount) => {
    expect(messages({ amount })).toContain("invalidAmount");
  });

  it("limits the note to 200 characters", () => {
    expect(messages({ note: "x".repeat(200) })).toEqual([]);
    expect(messages({ note: "x".repeat(201) })).toContain("noteTooLong");
  });

  it("requires a valid date and a subcategory", () => {
    expect(messages({ spentOn: "" })).toContain("invalidDate");
    expect(messages({ spentOn: "2026-02-30" })).toContain("invalidDate");
    expect(messages({ subcategoryId: "" })).toContain("subcategoryRequired");
  });
});
