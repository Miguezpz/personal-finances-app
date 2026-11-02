/**
 * Expense and card-payment forms (T090; validation tests in T088). Messages are i18n keys of the `expenses` namespace. The bucket is NOT a field:
 * it is inherited from the subcategory's parent category when saving (FR-014).
 */
import { z } from "zod";
import { isIsoDate } from "@/domain/dates";
import { parseMoneyInput } from "@/domain/parse";
import type { Cents, IsoDate, Uuid } from "@/domain/types";

export const expenseFormSchema = z
  .object({
    amount: z.string().transform((value, ctx) => {
      const parsed = parseMoneyInput(value);
      if (parsed === null || parsed <= 0) {
        ctx.addIssue({ code: "custom", message: "invalidAmount" });
        return z.NEVER;
      }
      return parsed as Cents;
    }),
    spentOn: z
      .string()
      .refine(isIsoDate, "invalidDate")
      .transform((v) => v as IsoDate),
    subcategoryId: z.string().min(1, "subcategoryRequired"),
    paymentAccountId: z.string(),
    note: z.string().trim().max(200, "noteTooLong"),
  })
  .transform((v) => ({
    amount: v.amount,
    spentOn: v.spentOn,
    subcategoryId: v.subcategoryId as Uuid,
    paymentAccountId: v.paymentAccountId ? (v.paymentAccountId as Uuid) : null,
    note: v.note ? v.note : null,
  }));

export type ExpenseFormInput = z.input<typeof expenseFormSchema>;
export type ExpenseFormOutput = z.output<typeof expenseFormSchema>;

/** Paying a credit card: a debt settlement, never a Needs/Wants expense (FR-013b). */
export const cardPaymentFormSchema = z
  .object({
    cardAccountId: z.string().min(1, "cardRequired"),
    amount: z.string().transform((value, ctx) => {
      const parsed = parseMoneyInput(value);
      if (parsed === null || parsed <= 0) {
        ctx.addIssue({ code: "custom", message: "invalidAmount" });
        return z.NEVER;
      }
      return parsed as Cents;
    }),
    paidOn: z
      .string()
      .refine(isIsoDate, "invalidDate")
      .transform((v) => v as IsoDate),
    fromAccountId: z.string(),
    note: z.string().trim().max(200, "noteTooLong"),
  })
  .transform((v) => ({
    cardAccountId: v.cardAccountId as Uuid,
    amount: v.amount,
    paidOn: v.paidOn,
    fromAccountId: v.fromAccountId ? (v.fromAccountId as Uuid) : null,
    note: v.note ? v.note : null,
  }));

export type CardPaymentFormInput = z.input<typeof cardPaymentFormSchema>;
export type CardPaymentFormOutput = z.output<typeof cardPaymentFormSchema>;
