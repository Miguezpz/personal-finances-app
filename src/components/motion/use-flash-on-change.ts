"use client";

/**
 * Background flash when a value changes (spec 003 FR-030; shared by the buckets, goals and net worth
 * in spec 010): re-key the block to replay `animate-balance-highlight`. Never on the first render,
 * and the amount's text itself is never animated.
 */
import { useState } from "react";

export function useFlashOnChange(value: unknown): { key: number; flashing: boolean } {
  const [shown, setShown] = useState(value);
  const [flashes, setFlashes] = useState(0);
  if (!Object.is(shown, value)) {
    setShown(value);
    setFlashes((n) => n + 1);
  }
  return { key: flashes, flashing: flashes > 0 };
}
