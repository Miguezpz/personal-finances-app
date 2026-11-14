import type { GoalsRepository, LedgerRepository, NetWorthRepository } from "../../provider";
import type { AppSupabaseClient } from "../client";
import {
  fromGoal,
  toContribution,
  toGoal,
  toLedgerEntry,
  toNetWorthSnapshot,
  toSavedMove,
  type Insert,
} from "../mappers";
import { exec, execNullable, selectAll, withinRange } from "./query";

export function createGoalsRepository(db: AppSupabaseClient): GoalsRepository {
  return {
    async list() {
      const [goals, contributions, savedMoves] = await Promise.all([
        selectAll((from, to) => db.from("goals").select("*").order("id").range(from, to)),
        selectAll((from, to) =>
          db.from("goal_contributions").select("*").order("id").range(from, to),
        ),
        selectAll((from, to) =>
          db.from("goal_saved_moves").select("*").order("id").range(from, to),
        ),
      ]);
      return {
        goals: goals.map(toGoal),
        contributions: contributions.map(toContribution),
        savedMoves: savedMoves.map(toSavedMove),
      };
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

    async addSavedMove(input) {
      const row = await exec(
        db
          .from("goal_saved_moves")
          .insert({ goal_id: input.goalId, moved_on: input.movedOn, amount_cents: input.amount })
          .select("*")
          .single(),
      );
      return toSavedMove(row);
    },

    async remove(id) {
      // shortcut: "no contributions" is only checked in the UI (the FK would cascade them too);
      // add a `before delete` trigger if goals ever get deleted from anywhere else.
      await execNullable(db.from("goals").delete().eq("id", id));
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
        // Spec 011: card payments are not movements anymore; the view still has the old rows.
        withinRange(
          db.from("ledger_entries").select("*").neq("entry_type", "card_payment"),
          "occurred_on",
          range,
        )
          .order("occurred_on", { ascending: false })
          .order("id")
          .range(from, to),
      );
      return rows.map(toLedgerEntry);
    },
  };
}
