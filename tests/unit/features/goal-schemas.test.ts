/**
 * Spec 014 (T014, T022) · Purchase goal form and the assign / return amount form.
 */
import { describe, expect, it } from "vitest";
import type { Cents } from "@/domain/types";
import { goalFormSchema, makeSavedMoveSchema } from "@/features/goals/schemas";

const purchase = {
  kind: "purchase" as const,
  name: "Laptop",
  sourceBucket: "needs" as const,
  targetMonths: "",
  annual: "",
  monthly: "500",
  target: "25,000",
  targetMonth: "",
};
const messages = (input: Parameters<typeof goalFormSchema.safeParse>[0]) => {
  const r = goalFormSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("goalFormSchema · purchase", () => {
  it("keeps the target, drops any monthly amount and stores Investment as the unused source", () => {
    expect(goalFormSchema.parse({ ...purchase, targetMonth: "2027-03" })).toEqual({
      kind: "purchase",
      name: "Laptop",
      sourceBucket: "investment",
      targetMonths: null,
      annual: null,
      monthly: null,
      target: 2_500_000,
      targetMonth: "2027-03-01",
    });
  });

  it("the target month is optional", () => {
    expect(goalFormSchema.parse(purchase).targetMonth).toBeNull();
  });

  it.each(["0", "-1", "", "abc"])("rejects the target %j", (target) => {
    expect(messages({ ...purchase, target })).toEqual(["invalidAmount"]);
  });

  it.each(["2027-13", "2027-3", "03/2027"])("rejects the month %j", (targetMonth) => {
    expect(messages({ ...purchase, targetMonth })).toEqual(["invalidMonth"]);
  });

  it("the name is 1–80 characters", () => {
    expect(messages({ ...purchase, name: " " })).toEqual(["nameRequired"]);
    expect(messages({ ...purchase, name: "x".repeat(81) })).toEqual(["nameTooLong"]);
  });
});

describe("makeSavedMoveSchema", () => {
  const schema = makeSavedMoveSchema(132_790 as Cents);
  const errors = (amount: string, goalId = "g1") => {
    const r = schema.safeParse({ goalId, amount });
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it("accepts up to the maximum, in cents", () => {
    expect(schema.parse({ goalId: "g1", amount: "1,327.90" })).toEqual({
      goalId: "g1",
      amount: 132_790,
    });
  });

  it("rejects one cent over the maximum", () => {
    expect(errors("1327.91")).toEqual(["overMax"]);
  });

  it.each(["0", "-5", ""])("rejects %j", (amount) => {
    expect(errors(amount)).toEqual(["invalidAmount"]);
  });

  it("needs a goal", () => {
    expect(errors("10", "")).toEqual(["goalRequired"]);
  });
});
