/**
 * Calculation preferences (T124, FR-041), mirroring the `user_settings` CHECKs: traffic-light
 * thresholds with yellow < green, collection lead days 0–15, emergency fund months 1–36,
 * paydays 1–31 (the second one after the first), an IANA time zone and the save-surplus switch
 * (spec 013). Messages are i18n keys of the `settings` namespace.
 */
import { z } from "zod";
import { parsePercentInput } from "@/domain/parse";
import type { BasisPoints } from "@/domain/types";

const intIn = (min: number, max: number, message: string) =>
  z.string().transform((value, ctx) => {
    const n = /^\d{1,2}$/.test(value.trim()) ? Number(value) : Number.NaN;
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return n;
  });

const percent = z.string().transform((value, ctx) => {
  const parsed = parsePercentInput(value);
  if (parsed === null) {
    ctx.addIssue({ code: "custom", message: "invalidPercent" });
    return z.NEVER;
  }
  return parsed as BasisPoints;
});

export const preferencesFormSchema = z
  .object({
    greenMinBps: percent,
    yellowMinBps: percent,
    collectionLeadDays: intIn(0, 15, "invalidLeadDays"),
    emergencyFundMonths: intIn(1, 36, "invalidFundMonths"),
    firstPayday: intIn(1, 31, "invalidPayday"),
    secondPayday: intIn(1, 31, "invalidPayday"),
    timezone: z.string().min(1, "timezoneRequired"),
    saveSurplus: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.greenMinBps < 1) {
      ctx.addIssue({ code: "custom", path: ["greenMinBps"], message: "greenAboveZero" });
    }
    if (v.yellowMinBps >= v.greenMinBps) {
      ctx.addIssue({ code: "custom", path: ["yellowMinBps"], message: "yellowBelowGreen" });
    }
    if (v.secondPayday <= v.firstPayday) {
      ctx.addIssue({ code: "custom", path: ["secondPayday"], message: "paydayOrder" });
    }
  });

export type PreferencesFormInput = z.input<typeof preferencesFormSchema>;
export type PreferencesFormOutput = z.output<typeof preferencesFormSchema>;
