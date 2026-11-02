/**
 * T044 · The production SupabaseProvider honours the same contract, against LOCAL Supabase.
 *
 * Needs `pnpm exec supabase start` and these variables (CI exports them; locally use
 * `pnpm test:contract:local`, which reads them from `supabase status`):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_TEST_SECRET_KEY
 *
 * Creates a throwaway user with the secret key (test setup only — never in app code), signs in
 * with the publishable key like the browser does, runs the suite, then deletes the user (all
 * its rows cascade). Refuses to run against anything but localhost: tests must never touch the
 * real cloud project.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";
import type { Database } from "@/data/supabase/database.types";
import { createSupabaseProvider } from "@/data/supabase/provider";
import { runDataProviderContract } from "./data-provider.contract";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;

const isLocal = (u: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(u);

if (!url || !publishableKey || !secretKey) {
  describe.skip("DataProvider contract · SupabaseProvider (local Supabase not configured)", () => {
    it("run `pnpm test:contract:local` with `supabase start` running", () => {});
  });
} else if (!isLocal(url)) {
  throw new Error(`Refusing to run contract tests against a non-local Supabase (${url}).`);
} else {
  runDataProviderContract(
    "SupabaseProvider (local Supabase)",
    async () => {
      const admin = createClient<Database>(url, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const email = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
      const password = `pw-${crypto.randomUUID()}`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw created.error;
      const userId = created.data.user.id;

      const client = createClient<Database>(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const provider = createSupabaseProvider({ client });
      await provider.auth.signIn(email, password);

      return {
        provider,
        dispose: async () => {
          await provider.auth.signOut().catch(() => undefined);
          const removed = await admin.auth.admin.deleteUser(userId);
          if (removed.error) throw removed.error;
        },
      };
    },
    { canWrite: true },
  );
}
