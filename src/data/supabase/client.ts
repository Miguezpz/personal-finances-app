/**
 * Browser Supabase client (T028). Together with the rest of src/data/supabase/**, the ONLY place
 * allowed to import @supabase/* (ESLint no-restricted-imports, Principle IV).
 * Uses the publishable key only; the session lives in cookies so proxy.ts can refresh it.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import type { Database } from "./database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

let browserClient: AppSupabaseClient | undefined;

export function getSupabaseBrowserClient(): AppSupabaseClient {
  if (browserClient) return browserClient;
  const { supabase } = getEnv();
  if (!supabase) {
    throw new Error("Supabase is not configured (demo mode never creates a Supabase client).");
  }
  browserClient = createBrowserClient<Database>(supabase.url, supabase.publishableKey);
  return browserClient;
}
