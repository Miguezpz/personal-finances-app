/**
 * Account / card form (T122, FR-039). Messages are i18n keys of the `settings` namespace.
 * A credit card needs its cut-off day (1–31) and the days from cut-off to the payment due date
 * (1–60), like the database CHECKs; other kinds never store them.
 */
import { z } from "zod";
import { parseMoneyInput } from "@/domain/parse";
import type { AccountKind, Cents } from "@/domain/types";

export const ACCOUNT_KINDS = [
  "checking",
  "savings",
  "credit_card",
  "investment",
  "cash",
] as const satisfies readonly AccountKind[];

const dayIn = (min: number, max: number, value: string) => {
  const n = /^\d{1,2}$/.test(value.trim()) ? Number(value) : Number.NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export const accountFormSchema = z
  .object({
    kind: z.enum(ACCOUNT_KINDS),
    name: z.string().trim().min(1, "nameRequired").max(60, "nameTooLong"),
    institution: z.string().trim().max(60, "institutionTooLong"),
    cutOffDay: z.string(),
    paymentDueOffsetDays: z.string(),
    openingBalance: z.string().transform((value, ctx) => {
      if (value.trim() === "") return 0 as Cents;
      const parsed = parseMoneyInput(value);
      if (parsed === null) {
        ctx.addIssue({ code: "custom", message: "invalidAmount" });
        return z.NEVER;
      }
      return parsed;
    }),
  })
  .transform((v, ctx) => {
    const isCard = v.kind === "credit_card";
    const cutOffDay = isCard ? dayIn(1, 31, v.cutOffDay) : null;
    const paymentDueOffsetDays = isCard ? dayIn(1, 60, v.paymentDueOffsetDays) : null;
    if (isCard && cutOffDay === null) {
      ctx.addIssue({ code: "custom", path: ["cutOffDay"], message: "invalidCutOffDay" });
    }
    if (isCard && paymentDueOffsetDays === null) {
      ctx.addIssue({ code: "custom", path: ["paymentDueOffsetDays"], message: "invalidDueOffset" });
    }
    return {
      kind: v.kind,
      name: v.name,
      institution: v.institution === "" ? null : v.institution,
      cutOffDay,
      paymentDueOffsetDays,
      openingBalance: v.openingBalance,
    };
  });

export type AccountFormInput = z.input<typeof accountFormSchema>;
export type AccountFormOutput = z.output<typeof accountFormSchema>;
