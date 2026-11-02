/**
 * Recurring expense form (T081, FR-007). Messages are i18n keys of the `recurring` namespace.
 * The bucket is not a field: it is copied from the subcategory's parent category when saving.
 */
import { z } from "zod";
import { isIsoDate } from "@/domain/dates";
import { parseMoneyInput } from "@/domain/parse";
import type { Cents, IsoDate, Uuid } from "@/domain/types";

export const recurringFormSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(80, "nameTooLong"),
    amount: z.string().transform((value, ctx) => {
      const parsed = parseMoneyInput(value);
      if (parsed === null || parsed <= 0) {
        ctx.addIssue({ code: "custom", message: "invalidAmount" });
        return z.NEVER;
      }
      return parsed as Cents;
    }),
    chargeDay: z.string().transform((value, ctx) => {
      const day = /^\d{1,2}$/.test(value.trim()) ? Number(value) : Number.NaN;
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        ctx.addIssue({ code: "custom", message: "invalidChargeDay" });
        return z.NEVER;
      }
      return day;
    }),
    subcategoryId: z.string().min(1, "subcategoryRequired"),
    paymentAccountId: z.string(),
    startsOn: z
      .string()
      .refine(isIsoDate, "invalidDate")
      .transform((v) => v as IsoDate),
  })
  .transform((v) => ({
    name: v.name,
    amount: v.amount,
    chargeDay: v.chargeDay,
    subcategoryId: v.subcategoryId as Uuid,
    paymentAccountId: v.paymentAccountId ? (v.paymentAccountId as Uuid) : null,
    startsOn: v.startsOn,
  }));

export type RecurringFormInput = z.input<typeof recurringFormSchema>;
export type RecurringFormOutput = z.output<typeof recurringFormSchema>;
