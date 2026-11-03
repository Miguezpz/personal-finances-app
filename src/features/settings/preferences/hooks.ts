"use client";

/** User settings hooks (T124): the settings selector + an optimistic update. */
import { useSnapshotMutation } from "@/data/snapshot-cache";
import { selectSettings, useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { UserSettings } from "@/domain/types";

export function useSettings() {
  return useFinanceSnapshot(selectSettings);
}

export function useUpdateSettings() {
  return useSnapshotMutation<Partial<UserSettings>, UserSettings>({
    mutationFn: (provider, patch) => provider.settings.update(patch),
    optimistic: (s, patch) => ({ ...s, settings: { ...s.settings, ...patch } }),
  });
}
