"use client";

/**
 * Monthly net-worth snapshot (T146, FR-031): the first time the app opens in a month, store that
 * month's assets / liabilities for the historical chart. Idempotent per month (domain + unique key
 * in the database); only when the provider can write (`useBackgroundSync`).
 */
import { appendNew, type BackgroundSync, useBackgroundSync } from "@/data/background-sync";
import type { NewEntity } from "@/data/provider";
import { computeNetWorth, dueNetWorthSnapshot } from "@/domain/net-worth";
import type { NetWorthSnapshot } from "@/domain/types";

const NET_WORTH_SYNC: BackgroundSync<NewEntity<NetWorthSnapshot>, NetWorthSnapshot> = {
  plan: (snapshot, today) =>
    dueNetWorthSnapshot(snapshot.netWorthSnapshots, computeNetWorth(snapshot, today), today),
  write: (provider, input) => provider.netWorth.upsertMonthly(input),
  merge: (current, saved) => ({
    ...current,
    netWorthSnapshots: appendNew(current.netWorthSnapshots, [saved]),
  }),
};

export function useNetWorthSnapshot(): void {
  useBackgroundSync(NET_WORTH_SYNC);
}
