/**
 * Distribution rule form (T061, FR-001/002). Inputs are the strings the user types ("12.5");
 * the output is exact basis points. Messages are i18n keys of the `rules` namespace; sum errors
 * carry `params.diffBps` so the form can say how much is missing or exceeding (US1-3).
 */
import { z } from "zod";
import { BPS_TOTAL } from "@/domain/money";
import { parsePercentInput } from "@/domain/parse";
import type { BasisPoints, Uuid } from "@/domain/types";

const percent = z.string().transform((value, ctx) => {
  const parsed = parsePercentInput(value);
  if (parsed === null) {
    ctx.addIssue({ code: "custom", message: "invalidPercent" });
    return z.NEVER;
  }
  return parsed;
});

export const ruleFormSchema = z
  .object({
    needs: percent,
    wants: percent,
    investment: percent,
    subrules: z.array(z.object({ accountId: z.string().min(1, "vehicleRequired"), pct: percent })),
  })
  .superRefine((v, ctx) => {
    const total = v.needs + v.wants + v.investment;
    if (total !== BPS_TOTAL) {
      ctx.addIssue({
        code: "custom",
        path: ["total"],
        message: total < BPS_TOTAL ? "sumMissing" : "sumExcess",
        params: { diffBps: Math.abs(BPS_TOTAL - total) },
      });
    }
    if (v.investment === 0) return;
    if (v.subrules.length === 0) {
      ctx.addIssue({ code: "custom", path: ["subrules"], message: "subrulesRequired" });
      return;
    }
    const seen = new Set<string>();
    v.subrules.forEach((s, i) => {
      if (seen.has(s.accountId)) {
        ctx.addIssue({
          code: "custom",
          path: ["subrules", i, "accountId"],
          message: "duplicateVehicle",
        });
      }
      seen.add(s.accountId);
    });
    const subTotal = v.subrules.reduce((s, x) => s + x.pct, 0);
    if (subTotal !== BPS_TOTAL) {
      ctx.addIssue({
        code: "custom",
        path: ["subrulesTotal"],
        message: subTotal < BPS_TOTAL ? "subrulesSumMissing" : "subrulesSumExcess",
        params: { diffBps: Math.abs(BPS_TOTAL - subTotal) },
      });
    }
  })
  .transform((v) => ({
    needs: v.needs as BasisPoints,
    wants: v.wants as BasisPoints,
    investment: v.investment as BasisPoints,
    // With no investment share, vehicles are irrelevant (and the DB rejects them).
    subrules:
      v.investment === 0
        ? []
        : v.subrules.map((s) => ({ accountId: s.accountId as Uuid, pct: s.pct as BasisPoints })),
  }));

export type RuleFormInput = z.input<typeof ruleFormSchema>;
export type RuleFormOutput = z.output<typeof ruleFormSchema>;
