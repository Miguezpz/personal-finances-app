/**
 * T145/T146 · Background goal contributions and the monthly net-worth snapshot: written once for
 * the current month, merged into the cache, never re-proposed, and nothing at all in the demo
 * (FR-047a). The goal form follows the `goals` CHECKs.
 */
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import type { DataProvider } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { cents } from "@/domain/money";
import type { FinanceSnapshot, GoalContribution, NetWorthSnapshot, Uuid } from "@/domain/types";
import { goalFormSchema } from "@/features/goals/schemas";
import { useMaterializeContributions } from "@/features/goals/useMaterializeContributions";
import { useNetWorthSnapshot } from "@/features/net-worth/useNetWorthSnapshot";
import { emptySnapshot, makeAccount, makeGoal } from "../../utils/fixtures";
import { renderHookWithProviders } from "../../utils/renderWithProviders";

const goal = makeGoal({ monthly: cents(100_000), sourceBucket: "needs" });
const snapshot = (): FinanceSnapshot =>
  emptySnapshot({ goals: [goal], accounts: [makeAccount({ openingBalance: cents(500_000) })] });

/** The mock's reads, but writable, with spies for the two background writes. */
function writableProvider(canWrite = true) {
  const base = createMockProvider({ snapshot: snapshot() });
  const addContributions = vi.fn(async (items: readonly Omit<GoalContribution, "id">[]) =>
    items.map((c, i) => ({ ...c, id: `00000000-0000-4000-b000-00000000000${i}` as Uuid })),
  );
  const upsertMonthly = vi.fn(async (input: Omit<NetWorthSnapshot, "id">) => ({
    ...input,
    id: "00000000-0000-4000-b000-0000000000aa" as Uuid,
  }));
  const provider: DataProvider = {
    ...base,
    capabilities: { canWrite },
    goals: { ...base.goals, addContributions },
    netWorth: { ...base.netWorth, upsertMonthly },
  };
  return { provider, addContributions, upsertMonthly };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T18:00:00Z")); // Nov 10 in Mexico City
});
afterEach(() => vi.useRealTimers());

describe("useMaterializeContributions", () => {
  it("holds back this month's amount once and merges it into the cache", async () => {
    const { provider, addContributions } = writableProvider();
    const { queryClient } = renderHookWithProviders(() => useMaterializeContributions(), {
      provider,
    });
    await waitFor(() => expect(addContributions).toHaveBeenCalledTimes(1));
    expect(addContributions.mock.calls[0]?.[0]).toEqual([
      { goalId: goal.id, periodStart: "2026-11-01", amount: 100_000, sourceBucket: "needs" },
    ]);
    await waitFor(() =>
      expect(
        queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot)?.contributions,
      ).toHaveLength(1),
    );
    // The merged row satisfies the plan: nothing else is proposed.
    await new Promise((r) => setTimeout(r, 50));
    expect(addContributions).toHaveBeenCalledTimes(1);
  });

  it("does nothing in the read-only demo", async () => {
    const { provider, addContributions } = writableProvider(false);
    const { queryClient } = renderHookWithProviders(() => useMaterializeContributions(), {
      provider,
    });
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.snapshot)).toBeDefined());
    await new Promise((r) => setTimeout(r, 50));
    expect(addContributions).not.toHaveBeenCalled();
  });
});

describe("useNetWorthSnapshot", () => {
  it("stores this month's net worth once", async () => {
    const { provider, upsertMonthly } = writableProvider();
    const { queryClient } = renderHookWithProviders(() => useNetWorthSnapshot(), { provider });
    await waitFor(() => expect(upsertMonthly).toHaveBeenCalledTimes(1));
    expect(upsertMonthly.mock.calls[0]?.[0]).toEqual({
      snapshotOn: "2026-11-01",
      assets: 500_000,
      liabilities: 0,
      netWorth: 500_000,
    });
    await waitFor(() =>
      expect(
        queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot)?.netWorthSnapshots,
      ).toHaveLength(1),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(upsertMonthly).toHaveBeenCalledTimes(1);
  });

  it("does nothing in the read-only demo", async () => {
    const { provider, upsertMonthly } = writableProvider(false);
    const { queryClient } = renderHookWithProviders(() => useNetWorthSnapshot(), { provider });
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.snapshot)).toBeDefined());
    await new Promise((r) => setTimeout(r, 50));
    expect(upsertMonthly).not.toHaveBeenCalled();
  });
});

describe("goalFormSchema", () => {
  const base = {
    name: "Car insurance",
    sourceBucket: "needs" as const,
    targetMonths: "",
    annual: "",
    monthly: "",
  };
  const messages = (input: Parameters<typeof goalFormSchema.safeParse>[0]) => {
    const r = goalFormSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it("sinking fund: annual > 0; an empty monthly is annual / 12 rounded up", () => {
    expect(goalFormSchema.parse({ ...base, kind: "sinking_fund", annual: "12,000" })).toEqual({
      kind: "sinking_fund",
      name: "Car insurance",
      sourceBucket: "needs",
      targetMonths: null,
      annual: 1_200_000,
      monthly: 100_000,
    });
    expect(
      goalFormSchema.parse({ ...base, kind: "sinking_fund", annual: "12000", monthly: "1500" })
        .monthly,
    ).toBe(150_000);
    expect(messages({ ...base, kind: "sinking_fund", annual: "0" })).toEqual(["invalidAmount"]);
  });

  it("emergency fund: 1–36 target months, optional monthly contribution, no annual amount", () => {
    expect(
      goalFormSchema.parse({ ...base, kind: "emergency_fund", targetMonths: "6", annual: "999" }),
    ).toMatchObject({
      targetMonths: 6,
      annual: null,
      monthly: null,
    });
    expect(messages({ ...base, kind: "emergency_fund", targetMonths: "37" })).toEqual([
      "invalidTargetMonths",
    ]);
    expect(messages({ ...base, kind: "emergency_fund", targetMonths: "6", monthly: "-5" })).toEqual(
      ["invalidAmount"],
    );
    expect(
      messages({ ...base, kind: "emergency_fund", name: "x".repeat(81), targetMonths: "6" }),
    ).toEqual(["nameTooLong"]);
  });
});
