/**
 * `?authError=` values set by /auth/callback (002-google-sign-in, contracts/auth-oauth.md § 3).
 * Anything else is ignored, so a crafted URL can't show arbitrary text.
 */
import type { OAuthErrorCode } from "@/data/provider";

const CODES: readonly OAuthErrorCode[] = ["not_authorized", "failed"];

export function parseOAuthError(value: string | null): OAuthErrorCode | null {
  return CODES.find((c) => c === value) ?? null;
}
