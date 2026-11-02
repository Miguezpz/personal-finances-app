import type { RulesRepository } from "../../provider";
import { ProviderError } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { toRule } from "../mappers";
import { exec, selectAll } from "./query";

export function createRulesRepository(db: AppSupabaseClient): RulesRepository {
  async function loadAll() {
    const [rules, subrules] = await Promise.all([
      selectAll((from, to) =>
        db.from("distribution_rules").select("*").order("id").range(from, to),
      ),
      selectAll((from, to) =>
        db.from("investment_subrules").select("*").order("id").range(from, to),
      ),
    ]);
    return rules
      .map((r) => toRule(r, subrules))
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  }

  return {
    list: loadAll,

    async save({ rule }) {
      // Atomic rule + sub-rules (RPC). Rejects with CONFLICT if the effective date is already used.
      const id = await exec(
        db.rpc("save_distribution_rule", {
          p_rule: {
            effective_from: rule.effectiveFrom,
            needs_bps: rule.needs,
            wants_bps: rule.wants,
            investment_bps: rule.investment,
          },
          p_subrules: rule.investmentSubrules.map((s) => ({
            account_id: s.accountId,
            pct_bps: s.pct,
          })),
        }),
      );
      const saved = (await loadAll()).find((r) => r.id === id);
      if (!saved) throw new ProviderError("NOT_FOUND", "Saved rule not found");
      return saved;
    },
  };
}
