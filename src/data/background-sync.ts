"use client";

/**
 * Background writes that run when the app opens (no server cron, Principle I): recurring charges,
 * goal contributions and the monthly net-worth snapshot (research.md R5/R14).
 *
 *  - `plan` (pure) proposes what's missing for the loaded snapshot; nothing → no write.
 *    Writes are idempotent on the server too (unique keys), so another tab can't duplicate them.
 *  - Never runs while user writes are in flight: the cache may hold OPTIMISTIC rows with temporary
 *    ids that don't exist in the database (foreign keys would fail).
 *  - One run at a time per hook; data that arrives during a run triggers another run.
 *  - A failure (offline / cold start) is retried on the next load.
 *  - Only when `provider.capabilities.canWrite`: in the demo it does nothing and shows nothing
 *    (FR-047a).
 */
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { FinanceSnapshot, IsoDate } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { useDataProvider } from "./context";
import type { DataProvider } from "./provider";
import { queryKeys } from "./query-keys";
import { useFinanceSnapshot } from "./useFinanceSnapshot";

export interface BackgroundSync<TPlan, TResult> {
  /** What to write for this snapshot, or null when nothing is due. Pure. */
  plan: (snapshot: FinanceSnapshot, today: IsoDate) => TPlan | null;
  write: (provider: DataProvider, plan: TPlan) => Promise<TResult>;
  /** Merge the server-confirmed result into the cached snapshot (no refetch needed). */
  merge: (current: FinanceSnapshot, result: TResult) => FinanceSnapshot;
}

/** `sync` must be a stable (module-level) definition. */
export function useBackgroundSync<TPlan, TResult>(sync: BackgroundSync<TPlan, TResult>): void {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  const today = useToday();
  const { data: snapshot, dataUpdatedAt } = useFinanceSnapshot();
  const mutating = useIsMutating();
  const running = useRef(false);
  const rerun = useRef(false);
  const [tick, setTick] = useState(0);
  const canWrite = provider.capabilities.canWrite;

  useEffect(() => {
    if (!canWrite || !snapshot || mutating > 0) return;
    if (running.current) {
      rerun.current = true;
      return;
    }
    const { plan, write, merge } = sync;
    const planned = plan(snapshot, today);
    if (planned === null) return;

    running.current = true;
    write(provider, planned)
      .then((result) => {
        queryClient.setQueryData<FinanceSnapshot>(queryKeys.snapshot, (current) =>
          current ? merge(current, result) : current,
        );
      })
      .catch(() => {
        // Transient (offline / cold start): retried on the next successful load.
      })
      .finally(() => {
        running.current = false;
        if (rerun.current) {
          rerun.current = false;
          setTick((t) => t + 1);
        }
      });
    // dataUpdatedAt: a refetch that returns identical data still deserves a retry after a failure.
  }, [sync, canWrite, provider, queryClient, snapshot, dataUpdatedAt, today, mutating, tick]);
}

/** Appends rows whose id isn't cached yet. */
export function appendNew<T extends { id: string }>(
  current: readonly T[],
  added: readonly T[],
): T[] {
  const known = new Set(current.map((x) => x.id));
  return [...current, ...added.filter((x) => !known.has(x.id))];
}
