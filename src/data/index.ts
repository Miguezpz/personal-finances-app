/**
 * Composition root of the data layer (T042). Resolves the provider at BUILD time:
 * Next inlines NEXT_PUBLIC_DEMO_MODE, so the unused branch — and with it every @supabase/*
 * import — is dropped from the demo bundle (Principle IV, checked by check:demo-bundle).
 */
import type { CreateDataProvider, DataProvider } from "./provider";

export const createDataProvider: CreateDataProvider = async (): Promise<DataProvider> => {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return (await import("./mock/provider")).createMockProvider();
  }
  return (await import("./supabase/provider")).createSupabaseProvider();
};
