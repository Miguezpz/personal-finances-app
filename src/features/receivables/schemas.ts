/**
 * Receivable (MSI for a third party) and collection forms (T098). Messages are i18n keys of the
 * `receivables` namespace. The debtor is either an existing one or a new name.
 */
import { z } from "zod";
import { isIsoDate } from "@/domain/dates";
import { MAX_TERM_MONTHS } from "@/domain/installments";
import { parseMoneyInput } from "@/domain/parse";
import type { Cents, IsoDate, Uuid } from "@/domain/types";

const money = z.string().transform((value, ctx) => {
  const parsed = parseMoneyInput(value);
  if (parsed === null || parsed <= 0) {
    ctx.addIssue({ code: "custom", message: "invalidAmount" });
    return z.NEVER;
  }
  return parsed as Cents;
});

const isoDate = z
  .string()
  .refine(isIsoDate, "invalidDate")
  .transform((v) => v as IsoDate);

export const receivableFormSchema = z
  .object({
    debtorId: z.string(),
    newDebtorName: z.string().trim().max(80, "debtorNameTooLong"),
    description: z.string().trim().min(1, "descriptionRequired").max(120, "descriptionTooLong"),
    total: money,
    termMonths: z.string().transform((value, ctx) => {
      const n = /^\d{1,2}$/.test(value.trim()) ? Number(value) : Number.NaN;
      if (!Number.isInteger(n) || n < 1 || n > MAX_TERM_MONTHS) {
        ctx.addIssue({ code: "custom", message: "invalidTerm" });
        return z.NEVER;
      }
      return n;
    }),
    cardAccountId: z.string().min(1, "cardRequired"),
    purchaseDate: isoDate,
  })
  .superRefine((v, ctx) => {
    if (!v.debtorId && !v.newDebtorName) {
      ctx.addIssue({ code: "custom", path: ["debtorId"], message: "debtorRequired" });
    }
  })
  .transform((v) => ({
    debtor: v.debtorId ? { id: v.debtorId as Uuid } : { name: v.newDebtorName },
    description: v.description,
    total: v.total,
    termMonths: v.termMonths,
    cardAccountId: v.cardAccountId as Uuid,
    purchaseDate: v.purchaseDate,
  }));

export type ReceivableFormInput = z.input<typeof receivableFormSchema>;
export type ReceivableFormOutput = z.output<typeof receivableFormSchema>;

/** Recording a collection: full, partial (amount) or back to pending (FR-026). */
export const collectionFormSchema = z
  .object({
    mode: z.enum(["full", "partial", "pending"]),
    partialAmount: z.string(),
    collectedOn: isoDate,
  })
  .superRefine((v, ctx) => {
    if (v.mode !== "partial") return;
    const parsed = parseMoneyInput(v.partialAmount);
    if (parsed === null || parsed <= 0) {
      ctx.addIssue({ code: "custom", path: ["partialAmount"], message: "invalidAmount" });
    }
  });

export type CollectionFormInput = z.input<typeof collectionFormSchema>;
