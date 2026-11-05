/**
 * Income form (T061). Messages are i18n keys of the `income` namespace.
 *  - kind "recurring": a fixed income, split by the rules by default (US1-1…6).
 *  - kind "oneOff": the user chooses to split it or record it without splitting (US1-7).
 *  - Either kind can be recorded without splitting when no rule is configured (edge case).
 *  - The income type is mandatory and has no default (spec 004, Clarification B): the form starts
 *    with "" and saving without choosing one shows `typeRequired`.
 */
import { z } from "zod";
import { isIsoDate } from "@/domain/dates";
import { isIncomeType } from "@/domain/income-types";
import { parseMoneyInput } from "@/domain/parse";
import { isPeriodStart } from "@/domain/periods";
import type { Cents, IncomeType, IsoDate, Uuid } from "@/domain/types";

const isoDate = z
  .string()
  .refine(isIsoDate, "invalidDate")
  .transform((v) => v as IsoDate);

export const incomeFormSchema = z
  .object({
    incomeType: z
      .string()
      .refine(isIncomeType, "typeRequired")
      .transform((v) => v as IncomeType),
    label: z.string().trim().min(1, "labelRequired").max(80, "labelTooLong"),
    amount: z.string().transform((value, ctx) => {
      const parsed = parseMoneyInput(value);
      if (parsed === null || parsed <= 0) {
        ctx.addIssue({ code: "custom", message: "invalidAmount" });
        return z.NEVER;
      }
      return parsed as Cents;
    }),
    receivedOn: isoDate,
    fundedPeriodStart: isoDate.refine(isPeriodStart, "invalidPeriod"),
    kind: z.enum(["recurring", "oneOff"]),
    /** Split by the rules (true) or record without splitting (false). */
    split: z.boolean(),
    depositAccountId: z.string(),
  })
  .transform((v) => ({
    label: v.label,
    amount: v.amount,
    receivedOn: v.receivedOn,
    fundedPeriodStart: v.fundedPeriodStart,
    isRecurring: v.kind === "recurring",
    distributed: v.split,
    depositAccountId: v.depositAccountId ? (v.depositAccountId as Uuid) : null,
    incomeType: v.incomeType,
  }));

export type IncomeFormInput = z.input<typeof incomeFormSchema>;
export type IncomeFormOutput = z.output<typeof incomeFormSchema>;
