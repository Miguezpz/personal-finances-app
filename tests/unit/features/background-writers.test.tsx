/**
 * T162 · FR-047a: with a read-only provider (the demo), no background process writes anything or
 * shows anything — even when every one of them has work due (empty taxonomy for onboarding, due
 * recurring charges, goal contributions and the month's net-worth snapshot).
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProviderProvider } from "@/data/context";
import { createMockProvider } from "@/data/mock/provider";
import type { DataProvider } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { cents } from "@/domain/money";
import { DEFAULT_TIMEZONE } from "@/domain/settings";
import { useMaterializeContributions } from "@/features/goals/useMaterializeContributions";
import { useNetWorthSnapshot } from "@/features/net-worth/useNetWorthSnapshot";
import { useMaterializeRecurring } from "@/features/recurring/useMaterializeRecurring";
import { useOnboarding } from "@/features/settings/onboarding";
import { MESSAGES } from "@/i18n/config";
import { createQueryClient } from "@/lib/query-client";
import { DEFAULT_PREFERENCES, usePreferences } from "@/store/preferences";
import { d, emptySnapshot, makeGoal, makeRecurring } from "../../utils/fixtures";

const READS = new Set([
  "list",
  "get",
  "listCategories",
  "listSubcategories",
  "getSession",
  "onChange",
]);

/** The demo provider with a spy on every write method of every repository. */
function spiedDemoProvider() {
  const base = createMockProvider({
    snapshot: emptySnapshot({
      recurring: [makeRecurring({ chargeDay: 1, startsOn: d("2026-09-01") })],
      goals: [makeGoal({ monthly: cents(100_000) })],
    }),
  });
  const writes = vi.fn();
  const wrapped: Record<string, unknown> = { ...base };
  for (const [name, repo] of Object.entries(base)) {
    if (typeof repo !== "object" || repo === null || name === "capabilities") continue;
    wrapped[name] = Object.fromEntries(
      Object.entries(repo).map(([method, fn]) => [
        method,
        typeof fn === "function" && !READS.has(method)
          ? (...args: unknown[]) => {
              writes(`${name}.${method}`);
              return (fn as (...a: unknown[]) => unknown)(...args);
            }
          : fn,
      ]),
    );
  }
  return { provider: wrapped as unknown as DataProvider, writes };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T18:00:00Z"));
  usePreferences.setState({ ...DEFAULT_PREFERENCES, hydrated: true });
});
afterEach(() => vi.useRealTimers());

describe("background writers in the read-only demo", () => {
  it("onboarding, recurring charges, goal contributions and net worth write nothing and notify nothing", async () => {
    const { provider, writes } = spiedDemoProvider();
    expect(provider.capabilities.canWrite).toBe(false);
    const onDemoReadOnly = vi.fn();
    const queryClient = createQueryClient({ onDemoReadOnly });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={MESSAGES.en} timeZone={DEFAULT_TIMEZONE}>
          <DataProviderProvider provider={provider}>{children}</DataProviderProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    );

    renderHook(
      () => {
        useOnboarding();
        useMaterializeRecurring();
        useMaterializeContributions();
        useNetWorthSnapshot();
      },
      { wrapper },
    );
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.snapshot)).toBeDefined());
    await new Promise((r) => setTimeout(r, 100));

    expect(writes).not.toHaveBeenCalled();
    expect(onDemoReadOnly).not.toHaveBeenCalled();
  });
});
