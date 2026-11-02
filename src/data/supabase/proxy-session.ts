/**
 * Session refresh for src/proxy.ts (T051). Lives under src/data/supabase so @supabase/* stays in
 * one directory (Principle IV). It is an OPTIMISTIC check only (Next's guidance for Proxy): real
 * authorization is RLS in the database.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import type { Database } from "./database.types";

export interface SessionRoutes {
  /** Paths that require a session (redirect to `/` without one). */
  isProtected: (pathname: string) => boolean;
  /** Where a signed-in user visiting the landing page goes. */
  home: string;
}

export async function refreshSession(
  request: NextRequest,
  routes: SessionRoutes,
): Promise<NextResponse> {
  const { supabase } = getEnv();
  if (!supabase) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const client = createServerClient<Database>(supabase.url, supabase.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Validates the JWT (and refreshes the session cookies when needed).
  const { data } = await client.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed auth cookies on the redirect.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!signedIn && routes.isProtected(pathname)) return redirectTo("/");
  if (signedIn && pathname === "/") return redirectTo(routes.home);
  return response;
}
