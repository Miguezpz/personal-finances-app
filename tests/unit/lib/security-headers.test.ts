import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

const SUPABASE = "https://abcdefghijklmnop.supabase.co";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1);

describe("contentSecurityPolicy", () => {
  it("only lets the page talk to itself, Supabase and the FX sources", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: `${SUPABASE}/`, isDev: false });
    expect(directive(csp, "connect-src")).toEqual([
      "'self'",
      SUPABASE,
      "https://api.frankfurter.dev",
      "https://open.er-api.com",
    ]);
  });

  it("blocks framing, plugins, <base> rewrites and foreign form posts", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: false });
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
    expect(directive(csp, "form-action")).toEqual(["'self'"]);
    expect(directive(csp, "default-src")).toEqual(["'self'"]);
  });

  it("allows eval and HMR websockets only in development", () => {
    const prod = contentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: false });
    const dev = contentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: true });
    expect(directive(prod, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(prod, "connect-src")).not.toContain("ws:");
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
  });

  it("the demo build has no Supabase origin at all", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: null, isDev: false });
    expect(csp).not.toContain("supabase");
    expect(directive(csp, "connect-src")).toEqual([
      "'self'",
      "https://api.frankfurter.dev",
      "https://open.er-api.com",
    ]);
  });
});

describe("securityHeaders", () => {
  const keys = (supabaseUrl: string | null) =>
    securityHeaders({ supabaseUrl, isDev: false }).map((h) => h.key);

  it("sends the hardening headers", () => {
    expect(keys(SUPABASE)).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Cross-Origin-Opener-Policy",
      ]),
    );
  });

  it("keeps only the personal deployment out of search engines", () => {
    expect(keys(SUPABASE)).toContain("X-Robots-Tag");
    expect(keys(null)).not.toContain("X-Robots-Tag");
  });
});
