/**
 * Quick expense forms (spec 005). Messages are i18n keys of the `quickExpenses` namespace.
 *  - `makeQuickExpenseOverrideSchema(today)`: "Record with another amount or date" (FR-007a).
 *  - `expenseTemplateFormSchema`: create/edit a template (FR-001), patterned on recurring/schemas.ts.
 */
import { z } from "zod";
import { isIsoDate } from "@/domain/dates";
import { parseMoneyInput } from "@/domain/parse";
import { TEMPLATE_NAME_MAX } from "@/domain/quick-expenses";
import type { Cents, IsoDate, Uuid } from "@/domain/types";

const positiveAmount = z.string().transform((value, ctx) => {
  const parsed = parseMoneyInput(value);
  if (parsed === null || parsed <= 0) {
    ctx.addIssue({ code: "custom", message: "invalidAmount" });
    return z.NEVER;
  }
  return parsed as Cents;
});

/** `today` is injected (business date in the user's time zone); a future date is rejected. */
export function makeQuickExpenseOverrideSchema(today: IsoDate) {
  return z.object({
    amount: positiveAmount,
    spentOn: z
      .string()
      .refine(isIsoDate, "invalidDate")
      .transform((v) => v as IsoDate)
      .refine((v) => v <= today, "futureDate"),
  });
}

export type QuickExpenseOverrideInput = z.input<ReturnType<typeof makeQuickExpenseOverrideSchema>>;
export type QuickExpenseOverrideOutput = z.output<
  ReturnType<typeof makeQuickExpenseOverrideSchema>
>;

export const expenseTemplateFormSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(TEMPLATE_NAME_MAX, "nameTooLong"),
    amount: positiveAmount,
    subcategoryId: z.string().min(1, "subcategoryRequired"),
    paymentAccountId: z.string(),
  })
  .transform((v) => ({
    name: v.name,
    amount: v.amount,
    subcategoryId: v.subcategoryId as Uuid,
    paymentAccountId: v.paymentAccountId ? (v.paymentAccountId as Uuid) : null,
  }));

export type ExpenseTemplateFormInput = z.input<typeof expenseTemplateFormSchema>;
export type ExpenseTemplateFormOutput = z.output<typeof expenseTemplateFormSchema>;
