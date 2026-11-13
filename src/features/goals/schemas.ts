/**
 * Goal form (T145, FR-030), mirroring the `goals` CHECKs. Messages are i18n keys of the `goals`
 * namespace.
 *  - Emergency fund: target in months of vital expenses (1–36); the monthly contribution is
 *    optional (without it the fund is only tracked).
 *  - Sinking fund: annual amount > 0 and monthly hold-back > 0 (empty = annual / 12, rounded up).
 *  - Purchase (spec 014): target > 0 and an optional target month (YYYY-MM, stored as the 1st).
 *    No monthly contributions: it only receives money from Saved.
 * Default source bucket: sinking fund → Needs, emergency fund → Investment (research.md R14). A
 * purchase never uses it; it stores Investment so the column stays NOT NULL (spec 014, R2).
 */
import { z } from "zod";
import { suggestedMonthly } from "@/domain/goals";
import { parseMoneyInput } from "@/domain/parse";
import type { Bucket, Cents, GoalKind, IsoDate } from "@/domain/types";

export const GOAL_KINDS = [
  "emergency_fund",
  "sinking_fund",
  "purchase",
] as const satisfies readonly GoalKind[];
export const GOAL_BUCKETS = ["needs", "wants", "investment"] as const satisfies readonly Bucket[];

export const DEFAULT_SOURCE_BUCKET: Record<GoalKind, Bucket> = {
  emergency_fund: "investment",
  sinking_fund: "needs",
  purchase: "investment",
};

const positiveMoney = (value: string): Cents | null => {
  const parsed = parseMoneyInput(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

export const goalFormSchema = z
  .object({
    kind: z.enum(GOAL_KINDS),
    name: z.string().trim().min(1, "nameRequired").max(80, "nameTooLong"),
    sourceBucket: z.enum(GOAL_BUCKETS),
    targetMonths: z.string(),
    annual: z.string(),
    monthly: z.string(),
    target: z.string(),
    targetMonth: z.string(),
  })
  .transform((v, ctx) => {
    if (v.kind === "purchase") {
      const target = positiveMoney(v.target);
      if (target === null) {
        ctx.addIssue({ code: "custom", path: ["target"], message: "invalidAmount" });
      }
      const month = v.targetMonth.trim();
      if (month !== "" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        ctx.addIssue({ code: "custom", path: ["targetMonth"], message: "invalidMonth" });
      }
      return {
        kind: v.kind,
        name: v.name,
        sourceBucket: DEFAULT_SOURCE_BUCKET.purchase,
        targetMonths: null,
        annual: null,
        monthly: null,
        target,
        targetMonth: month === "" ? null : (`${month}-01` as IsoDate),
      };
    }

    const monthlyGiven = v.monthly.trim() !== "";
    const monthly = monthlyGiven ? positiveMoney(v.monthly) : null;
    if (monthlyGiven && monthly === null) {
      ctx.addIssue({ code: "custom", path: ["monthly"], message: "invalidAmount" });
    }

    if (v.kind === "emergency_fund") {
      const months = /^\d{1,2}$/.test(v.targetMonths.trim()) ? Number(v.targetMonths) : Number.NaN;
      if (!Number.isInteger(months) || months < 1 || months > 36) {
        ctx.addIssue({ code: "custom", path: ["targetMonths"], message: "invalidTargetMonths" });
      }
      return {
        kind: v.kind,
        name: v.name,
        sourceBucket: v.sourceBucket,
        targetMonths: months,
        annual: null,
        monthly,
        target: null,
        targetMonth: null,
      };
    }

    const annual = positiveMoney(v.annual);
    if (annual === null) {
      ctx.addIssue({ code: "custom", path: ["annual"], message: "invalidAmount" });
    }
    return {
      kind: v.kind,
      name: v.name,
      sourceBucket: v.sourceBucket,
      targetMonths: null,
      annual,
      monthly: monthlyGiven ? monthly : annual === null ? null : suggestedMonthly(annual),
      target: null,
      targetMonth: null,
    };
  });

export type GoalFormInput = z.input<typeof goalFormSchema>;
export type GoalFormOutput = z.output<typeof goalFormSchema>;

/**
 * Assign Saved to a goal, or return it (spec 014, FR-004/FR-010). `max` is what's available to
 * assign (floored at 0) or the goal's net from Saved; the sign is set by the dialog's mode.
 */
export function makeSavedMoveSchema(max: Cents) {
  return z
    .object({ goalId: z.string().min(1, "goalRequired"), amount: z.string() })
    .transform((v, ctx) => {
      const amount = positiveMoney(v.amount);
      if (amount === null) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "invalidAmount" });
      } else if (amount > max) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "overMax" });
      }
      return { goalId: v.goalId, amount: (amount ?? 0) as Cents };
    });
}

export type SavedMoveFormInput = z.input<ReturnType<typeof makeSavedMoveSchema>>;
export type SavedMoveFormOutput = z.output<ReturnType<typeof makeSavedMoveSchema>>;
