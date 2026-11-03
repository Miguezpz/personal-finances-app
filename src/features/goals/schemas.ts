/**
 * Goal form (T145, FR-030), mirroring the `goals` CHECKs. Messages are i18n keys of the `goals`
 * namespace.
 *  - Emergency fund: target in months of vital expenses (1–36); the monthly contribution is
 *    optional (without it the fund is only tracked).
 *  - Sinking fund: annual amount > 0 and monthly hold-back > 0 (empty = annual / 12, rounded up).
 * Default source bucket: sinking fund → Needs, emergency fund → Investment (research.md R14).
 */
import { z } from "zod";
import { suggestedMonthly } from "@/domain/goals";
import { parseMoneyInput } from "@/domain/parse";
import type { Bucket, Cents, GoalKind } from "@/domain/types";

export const GOAL_KINDS = ["emergency_fund", "sinking_fund"] as const satisfies readonly GoalKind[];
export const GOAL_BUCKETS = ["needs", "wants", "investment"] as const satisfies readonly Bucket[];

export const DEFAULT_SOURCE_BUCKET: Record<GoalKind, Bucket> = {
  emergency_fund: "investment",
  sinking_fund: "needs",
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
  })
  .transform((v, ctx) => {
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
    };
  });

export type GoalFormInput = z.input<typeof goalFormSchema>;
export type GoalFormOutput = z.output<typeof goalFormSchema>;
