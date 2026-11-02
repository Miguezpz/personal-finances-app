/**
 * T058 · Rule form validation (US1-3, FR-001/002): percentages must sum to exactly 100% and the
 * error says how much is missing or exceeding; investment sub-rules must sum to 100% when the
 * investment share is > 0.
 */
import { describe, expect, it } from "vitest";
import { ruleFormSchema, type RuleFormInput } from "@/features/settings/rules/schema";

const valid: RuleFormInput = {
  needs: "50",
  wants: "30",
  investment: "20",
  subrules: [
    { accountId: "00000000-0000-4000-8000-0000000000a1", pct: "90" },
    { accountId: "00000000-0000-4000-8000-0000000000a2", pct: "10" },
  ],
};

function issues(input: RuleFormInput) {
  const r = ruleFormSchema.safeParse(input);
  return r.success ? [] : r.error.issues;
}

describe("ruleFormSchema", () => {
  it("accepts 50/30/20 with 90/10 sub-rules and converts to basis points", () => {
    const r = ruleFormSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toEqual({
      needs: 5000,
      wants: 3000,
      investment: 2000,
      subrules: [
        { accountId: valid.subrules[0]?.accountId, pct: 9000 },
        { accountId: valid.subrules[1]?.accountId, pct: 1000 },
      ],
    });
  });

  it("rejects 50/30/30 and reports a 10% excess", () => {
    const [issue] = issues({ ...valid, investment: "30" });
    expect(issue?.message).toBe("sumExcess");
    expect(issue?.path).toEqual(["total"]);
    expect((issue as { params?: { diffBps?: number } }).params?.diffBps).toBe(1000);
  });

  it("rejects 50/30/10 and reports a 10% gap", () => {
    const [issue] = issues({ ...valid, investment: "10", subrules: valid.subrules });
    expect(issue?.message).toBe("sumMissing");
    expect((issue as { params?: { diffBps?: number } }).params?.diffBps).toBe(1000);
  });

  it("handles decimals exactly (33.33 + 33.33 + 33.34 = 100)", () => {
    expect(
      issues({ needs: "33.33", wants: "33.33", investment: "33.34", subrules: valid.subrules }),
    ).toEqual([]);
  });

  it("rejects sub-rules that don't sum to 100% when investment > 0", () => {
    const found = issues({
      ...valid,
      subrules: [{ accountId: "00000000-0000-4000-8000-0000000000a1", pct: "80" }],
    });
    expect(found.map((i) => i.message)).toContain("subrulesSumMissing");
  });

  it("requires at least one vehicle when investment > 0", () => {
    expect(issues({ ...valid, subrules: [] }).map((i) => i.message)).toContain("subrulesRequired");
  });

  it("ignores sub-rules entirely when investment is 0", () => {
    const r = ruleFormSchema.safeParse({
      needs: "60",
      wants: "40",
      investment: "0",
      subrules: valid.subrules,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.subrules).toEqual([]);
  });

  it("rejects malformed percentages and repeated vehicles", () => {
    expect(issues({ ...valid, needs: "abc" }).map((i) => i.message)).toContain("invalidPercent");
    expect(
      issues({
        ...valid,
        subrules: [
          { accountId: "00000000-0000-4000-8000-0000000000a1", pct: "50" },
          { accountId: "00000000-0000-4000-8000-0000000000a1", pct: "50" },
        ],
      }).map((i) => i.message),
    ).toContain("duplicateVehicle");
  });
});
