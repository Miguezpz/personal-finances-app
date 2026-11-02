/**
 * Email + password auth (T037). Signups are disabled in Supabase; the single owner is created
 * from the dashboard. The session is stored in cookies by @supabase/ssr.
 */
import type { Session } from "@supabase/supabase-js";
import type { Uuid } from "@/domain/types";
import type { AuthPort, AuthSession } from "../provider";
import { ProviderError } from "../provider";
import type { AppSupabaseClient } from "./client";
import { toProviderError } from "./mappers";

const toSession = (s: Session | null): AuthSession | null =>
  s ? { userId: s.user.id as Uuid, email: s.user.email ?? null } : null;

export function createSupabaseAuth(db: AppSupabaseClient): AuthPort {
  return {
    async getSession() {
      const { data, error } = await db.auth.getSession();
      if (error) throw toProviderError(error);
      return toSession(data.session);
    },

    async signIn(email, password) {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) {
        // Only wrong credentials become UNAUTHENTICATED; anything else (network, cold start,
        // a disabled provider…) keeps its own code and message so it can be diagnosed.
        if (error.code === "invalid_credentials") {
          throw new ProviderError("UNAUTHENTICATED", "Invalid email or password", error);
        }
        throw toProviderError(error);
      }
      const session = toSession(data.session);
      if (!session) throw new ProviderError("UNAUTHENTICATED", "No session returned");
      return session;
    },

    async signOut() {
      const { error } = await db.auth.signOut();
      if (error) throw toProviderError(error);
    },

    onChange(cb) {
      const { data } = db.auth.onAuthStateChange((_event, session) => cb(toSession(session)));
      return () => data.subscription.unsubscribe();
    },
  };
}
