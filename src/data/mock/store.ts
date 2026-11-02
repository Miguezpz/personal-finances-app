/**
 * In-memory store for the demo (T038). Holds one FinanceSnapshot, deep-frozen: the demo is
 * read-only, so nothing (not even a bug in a component) can mutate it.
 */
import type { FinanceSnapshot } from "@/domain/types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

export interface MockStore {
  readonly snapshot: FinanceSnapshot;
}

export function createMockStore(snapshot: FinanceSnapshot): MockStore {
  return { snapshot: deepFreeze(snapshot) };
}
