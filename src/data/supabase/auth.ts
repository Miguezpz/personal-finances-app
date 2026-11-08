/**
 * Email + password auth (T037) and Google OAuth (002-google-sign-in). Signups are disabled in
 * Supabase; the single owner is created from the dashboard and Google links to it by email. The
 * session is stored in cookies by @supabase/ssr.
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

    async signInWithGoogle(redirectTo) {
      // PKCE (default flow of @supabase/ssr's browser client): the code verifier is stored in a
      // cookie and consumed by /auth/callback (src/data/supabase/oauth-callback.ts).
      const { error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } },
      });
      if (error) throw toProviderError(error);
    },

    async signOut() {
      // Global scope revokes every refresh token of the account (all devices). If that call
      // fails (offline, cold start), still drop this device's session cookies so the browser
      // can't keep using them, then report the failure.
      const { error } = await db.auth.signOut();
      if (error) {
        await db.auth.signOut({ scope: "local" }).catch(() => undefined);
        throw toProviderError(error);
      }
    },

    onChange(cb) {
      const { data } = db.auth.onAuthStateChange((_event, session) => cb(toSession(session)));
      return () => data.subscription.unsubscribe();
    },
  };
}
