import type { GoalsRepository, LedgerRepository, NetWorthRepository } from "../../provider";
import type { AppSupabaseClient } from "../client";
import {
  fromGoal,
  toContribution,
  toGoal,
  toLedgerEntry,
  toNetWorthSnapshot,
  type Insert,
} from "../mappers";
import { exec, selectAll, withinRange } from "./query";

export function createGoalsRepository(db: AppSupabaseClient): GoalsRepository {
  return {
    async list() {
      const [goals, contributions] = await Promise.all([
        selectAll((from, to) => db.from("goals").select("*").order("id").range(from, to)),
        selectAll((from, to) =>
          db.from("goal_contributions").select("*").order("id").range(from, to),
        ),
      ]);
      return { goals: goals.map(toGoal), contributions: contributions.map(toContribution) };
    },

    async create(input) {
      const row = await exec(
        db
          .from("goals")
          .insert(fromGoal(input) as Insert<"goals">)
          .select("*")
          .single(),
      );
      return toGoal(row);
    },

    async update(id, patch) {
      const row = await exec(
        db.from("goals").update(fromGoal(patch)).eq("id", id).select("*").single(),
      );
      return toGoal(row);
    },

    async addContributions(items) {
      if (items.length === 0) return [];
      // Idempotent per (goal_id, period_start): duplicates are ignored, only new rows return.
      const rows = await exec(
        db
          .from("goal_contributions")
          .upsert(
            items.map((c) => ({
              goal_id: c.goalId,
              period_start: c.periodStart,
              amount_cents: c.amount,
              source_bucket: c.sourceBucket,
            })),
            { onConflict: "goal_id,period_start", ignoreDuplicates: true },
          )
          .select("*"),
      );
      return rows.map(toContribution);
    },
  };
}

export function createNetWorthRepository(db: AppSupabaseClient): NetWorthRepository {
  return {
    async list() {
      const rows = await selectAll((from, to) =>
        db.from("net_worth_snapshots").select("*").order("snapshot_on").range(from, to),
      );
      return rows.map(toNetWorthSnapshot);
    },

    async upsertMonthly(input) {
      // Idempotent per month: an existing snapshot is kept and returned unchanged.
      const inserted = await exec(
        db
          .from("net_worth_snapshots")
          .upsert(
            {
              snapshot_on: input.snapshotOn,
              assets_cents: input.assets,
              liabilities_cents: input.liabilities,
            },
            { onConflict: "user_id,snapshot_on", ignoreDuplicates: true },
          )
          .select("*"),
      );
      const row =
        inserted[0] ??
        (await exec(
          db.from("net_worth_snapshots").select("*").eq("snapshot_on", input.snapshotOn).single(),
        ));
      return toNetWorthSnapshot(row);
    },
  };
}

export function createLedgerRepository(db: AppSupabaseClient): LedgerRepository {
  return {
    async list(range) {
      const rows = await selectAll((from, to) =>
        withinRange(db.from("ledger_entries").select("*"), "occurred_on", range)
          .order("occurred_on", { ascending: false })
          .order("id")
          .range(from, to),
      );
      return rows.map(toLedgerEntry);
    },
  };
}
