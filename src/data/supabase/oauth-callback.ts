/**
 * Google OAuth return route (002-google-sign-in, contracts/auth-oauth.md § 2). Lives under
 * src/data/supabase so @supabase/* stays in one directory (Principle IV); src/app/auth/callback/route.ts
 * only loads it in the live build.
 *
 * Supabase Auth sends the browser here with `?code=` (PKCE) on success or `?error=&error_code=` on
 * failure. The code is exchanged for a session on the server so the session cookies are already on
 * the redirect to /dashboard. The destination is ALWAYS an internal path (no open redirect), and
 * the provider's error_description is never forwarded (Principle V, i18n).
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import type { OAuthErrorCode } from "../provider";
import type { Database } from "./database.types";

const SUCCESS_PATH = "/dashboard";
const failurePath = (code: OAuthErrorCode) => `/?authError=${code}`;

export interface CallbackDeps {
  /** Exchanges the PKCE code for a session; false when Supabase rejects it. */
  exchange(code: string): Promise<boolean>;
  /** Whether the request already carries a valid session. */
  hasSession(): Promise<boolean>;
}

/** Where to send the browser. Pure: every side effect comes through `deps`. */
export async function resolveCallback(
  params: URLSearchParams,
  deps: CallbackDeps,
): Promise<string> {
  if (params.has("error") || params.has("error_code")) {
    // signup_disabled: a Google account that isn't linked to the owner (sign-ups are off).
    return failurePath(
      params.get("error_code") === "signup_disabled" ? "not_authorized" : "failed",
    );
  }

  const code = params.get("code");
  if (code) {
    try {
      return (await deps.exchange(code)) ? SUCCESS_PATH : failurePath("failed");
    } catch {
      return failurePath("failed");
    }
  }

  try {
    return (await deps.hasSession()) ? SUCCESS_PATH : failurePath("failed");
  } catch {
    return failurePath("failed");
  }
}

export async function handleOAuthCallback(request: NextRequest): Promise<NextResponse> {
  const { supabase } = getEnv();
  if (!supabase) return NextResponse.redirect(new URL("/", request.nextUrl.origin));

  // Cookies written by the exchange are collected here and copied onto the final redirect.
  const pending: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const client = createServerClient<Database>(supabase.url, supabase.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach((c) => pending.push(c));
      },
    },
  });

  const path = await resolveCallback(request.nextUrl.searchParams, {
    async exchange(code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      return !error;
    },
    async hasSession() {
      const { data } = await client.auth.getClaims();
      return Boolean(data?.claims?.sub);
    },
  });

  // Same origin only: the path is one of our constants, resolved against this request's origin.
  const response = NextResponse.redirect(new URL(path, request.nextUrl.origin));
  pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
