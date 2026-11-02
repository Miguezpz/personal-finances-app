/**
 * Proxy (Next ≥ 16 name for middleware, T051): refreshes the Supabase session and redirects
 * between the landing page and the authenticated area. A complete no-op in the demo, which has
 * no Supabase at all (the session module is never even loaded there).
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export const APP_HOME = "/dashboard";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/income",
  "/expenses",
  "/recurring",
  "/receivables",
  "/credit",
  "/goals",
  "/net-worth",
  "/ledger",
  "/settings",
] as const;

export const isProtectedPath = (pathname: string) =>
  PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  if (env.isDemo) return NextResponse.next();
  const { refreshSession } = await import("@/data/supabase/proxy-session");
  return refreshSession(request, { isProtected: isProtectedPath, home: APP_HOME });
}

export const config = {
  // Everything except static assets and image optimization.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
