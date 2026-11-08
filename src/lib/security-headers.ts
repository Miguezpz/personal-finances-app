/**
 * HTTP security headers for every route (next.config.ts → headers()). Pure and alias-free so
 * next.config.ts can import it and unit tests can check it.
 *
 * CSP "without nonces" (Next's CSP guide): nonces need per-request dynamic rendering, which would
 * drop the prerendered shell (cacheComponents / partialPrefetching). So scripts keep
 * 'unsafe-inline' (Next's inline flight data + PREFERENCES_BOOT_SCRIPT); the protection comes from
 * the rest of the policy:
 *  - connect-src limits where a page can send data: only this origin, Supabase and the two
 *    keyless FX sources (src/features/fx/api.ts). An injected script can't exfiltrate the
 *    session cookie (@supabase/ssr cookies aren't HttpOnly) or the finances anywhere else.
 *  - no foreign scripts, frames, plugins or <base> rewrites; nobody can frame the app (clickjacking).
 */

export interface SecurityHeadersOptions {
  /** Supabase project URL (live build only); null in the demo, which never calls Supabase. */
  readonly supabaseUrl: string | null;
  /** `next dev`: React needs 'unsafe-eval' for its debugging stacks (not used in production). */
  readonly isDev: boolean;
}

export interface Header {
  readonly key: string;
  readonly value: string;
}

/** Keyless exchange-rate APIs called from the browser (src/features/fx/api.ts). */
export const FX_ORIGINS = ["https://api.frankfurter.dev", "https://open.er-api.com"] as const;

export function contentSecurityPolicy({ supabaseUrl, isDev }: SecurityHeadersOptions): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const directives: Record<string, readonly string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      ...(supabaseOrigin ? [supabaseOrigin] : []),
      ...FX_ORIGINS,
      // Turbopack HMR in `next dev`.
      ...(isDev ? ["ws:"] : []),
    ],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  // No upgrade-insecure-requests: Vercel already forces HTTPS (HSTS preload) and the e2e servers
  // run over http://localhost against a local http Supabase.
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(options: SecurityHeadersOptions): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Legacy twin of frame-ancestors 'none' for older browsers.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // The personal deployment is private: keep it out of search engines. The demo stays indexable.
    ...(options.supabaseUrl ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
  ];
}
