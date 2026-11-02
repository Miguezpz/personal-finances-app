import type { Uuid } from "@/domain/types";
import type { IncomesRepository, RegisterIncomeInput } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { fromAllocation, fromIncome, toAllocation, toIncome } from "../mappers";
import { chunk, exec, execNullable, selectAll, withinRange, type DateRange } from "./query";

export function createIncomesRepository(db: AppSupabaseClient): IncomesRepository {
  async function getIncome(id: string) {
    return toIncome(await exec(db.from("incomes").select("*").eq("id", id).single()));
  }

  const rpcArgs = (input: RegisterIncomeInput) => ({
    p_income: fromIncome(input.income),
    p_allocations: input.allocations.map(fromAllocation),
  });

  return {
    async list(range: DateRange) {
      const incomes = await selectAll((from, to) =>
        withinRange(db.from("incomes").select("*"), "received_on", range)
          .order("id")
          .range(from, to),
      );
      let allocations;
      if (range) {
        allocations = [];
        for (const ids of chunk(incomes.map((i) => i.id))) {
          allocations.push(
            ...(await selectAll((from, to) =>
              db
                .from("income_allocations")
                .select("*")
                .in("income_id", ids)
                .order("id")
                .range(from, to),
            )),
          );
        }
      } else {
        allocations = await selectAll((from, to) =>
          db.from("income_allocations").select("*").order("id").range(from, to),
        );
      }
      return { incomes: incomes.map(toIncome), allocations: allocations.map(toAllocation) };
    },

    async register(input) {
      // Atomic income + allocations; the exact sum is validated at COMMIT (→ VALIDATION).
      const id = await exec(db.rpc("register_income", rpcArgs(input)));
      return getIncome(id);
    },

    async replace(id: Uuid, input) {
      await exec(db.rpc("replace_income", { p_id: id, ...rpcArgs(input) }));
      return getIncome(id);
    },

    async remove(id) {
      await execNullable(db.from("incomes").delete().eq("id", id)); // allocations cascade
    },
  };
}
