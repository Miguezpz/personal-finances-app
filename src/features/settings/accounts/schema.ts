/**
 * Account / card form (T122, FR-039). Messages are i18n keys of the `settings` namespace.
 * A credit card needs its cut-off day (1–31) and the days from cut-off to the payment due date
 * (1–60), like the database CHECKs; other kinds never store them.
 *
 * Spec 007: by default the card terms come from one statement (`termsMode: "statement"`): its
 * cut-off and due dates give the day and the days to pay (domain/card-terms.ts). The numbers can
 * still be typed by hand (`"manual"`). Either way the output is the same.
 */
import { z } from "zod";
import { cardTermsFromStatement } from "@/domain/card-terms";
import { isIsoDate } from "@/domain/dates";
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
    termsMode: z.enum(["statement", "manual"]).default("manual"),
    statementCutOffOn: z.string().default(""),
    statementDueOn: z.string().default(""),
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
    let cutOffDay: number | null = null;
    let paymentDueOffsetDays: number | null = null;
    if (isCard && v.termsMode === "statement") {
      const cutOffOn = v.statementCutOffOn.trim();
      const dueOn = v.statementDueOn.trim();
      if (!isIsoDate(cutOffOn)) {
        ctx.addIssue({ code: "custom", path: ["statementCutOffOn"], message: "invalidCutOffDate" });
      }
      if (!isIsoDate(dueOn)) {
        ctx.addIssue({ code: "custom", path: ["statementDueOn"], message: "invalidDueDate" });
      }
      if (isIsoDate(cutOffOn) && isIsoDate(dueOn)) {
        const r = cardTermsFromStatement(cutOffOn, dueOn);
        if (r.ok) {
          ({ cutOffDay, paymentDueOffsetDays } = r.terms);
        } else {
          ctx.addIssue({ code: "custom", path: ["statementDueOn"], message: r.error });
        }
      }
    } else if (isCard) {
      cutOffDay = dayIn(1, 31, v.cutOffDay);
      paymentDueOffsetDays = dayIn(1, 60, v.paymentDueOffsetDays);
      if (cutOffDay === null) {
        ctx.addIssue({ code: "custom", path: ["cutOffDay"], message: "invalidCutOffDay" });
      }
      if (paymentDueOffsetDays === null) {
        ctx.addIssue({
          code: "custom",
          path: ["paymentDueOffsetDays"],
          message: "invalidDueOffset",
        });
      }
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
