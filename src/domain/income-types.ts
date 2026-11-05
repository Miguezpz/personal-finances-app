/**
 * Income types (spec 004, FR-006): a fixed list, not editable by the user. Same values and order as
 * the `public.income_type` enum of migration 0008, which is also the order of the form's options.
 */
export const INCOME_TYPES = [
  "salary",
  "gift",
  "debt_repayment",
  "cashback",
  "extra",
  "sales",
  "savings",
  "investment_returns",
  "other",
] as const;

export type IncomeType = (typeof INCOME_TYPES)[number];

export const isIncomeType = (value: unknown): value is IncomeType =>
  typeof value === "string" && (INCOME_TYPES as readonly string[]).includes(value);
