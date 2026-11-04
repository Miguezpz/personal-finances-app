/**
 * Google OAuth return route (002-google-sign-in). The demo has no sign-in at all: it goes home
 * without loading anything from Supabase (NEXT_PUBLIC_DEMO_MODE is a build-time constant, so the
 * dynamic import below is dropped from the demo build — same pattern as src/proxy.ts).
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  if (env.isDemo) return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  const { handleOAuthCallback } = await import("@/data/supabase/oauth-callback");
  return handleOAuthCallback(request);
}
