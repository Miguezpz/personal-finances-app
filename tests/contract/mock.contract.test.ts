/** T043 · The demo MockProvider honours the shared DataProvider contract. */
import { createMockProvider } from "@/data/mock/provider";
import type { IsoDate } from "@/domain/types";
import { runDataProviderContract } from "./data-provider.contract";

runDataProviderContract(
  "MockProvider (demo)",
  async () => ({
    provider: createMockProvider({ today: "2026-11-01" as IsoDate }),
    dispose: async () => {},
  }),
  { canWrite: false },
);
