"use client";

/**
 * Monthly goal contributions (T145, FR-030, US10-2): when the app opens, each active goal with a
 * monthly amount holds it back for the current month from its source bucket (dated the first
 * quincena). Idempotent per (goal, month) in the domain and in the database; same scheduling and
 * demo rule as recurring charges (`useBackgroundSync`).
 */
import { appendNew, type BackgroundSync, useBackgroundSync } from "@/data/background-sync";
import type { NewEntity } from "@/data/provider";
import { dueContributions } from "@/domain/goals";
import type { GoalContribution } from "@/domain/types";

const CONTRIBUTIONS_SYNC: BackgroundSync<NewEntity<GoalContribution>[], GoalContribution[]> = {
  plan: (snapshot, today) => {
    const due = dueContributions(snapshot.goals, snapshot.contributions, today);
    return due.length > 0 ? due : null;
  },
  write: (provider, items) => provider.goals.addContributions(items),
  merge: (current, inserted) => ({
    ...current,
    contributions: appendNew(current.contributions, inserted),
  }),
};

export function useMaterializeContributions(): void {
  useBackgroundSync(CONTRIBUTIONS_SYNC);
}
