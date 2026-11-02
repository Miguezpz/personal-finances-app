import { describe, expect, it } from "vitest";
import { EnvError, parseEnv, type RawEnv } from "@/lib/env";

const base: RawEnv = {
  NEXT_PUBLIC_DEMO_MODE: undefined,
  NEXT_PUBLIC_DEMO_URL: undefined,
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
};

const b64url = (obj: object) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const legacyJwt = (role: string) => `${b64url({ alg: "HS256" })}.${b64url({ role })}.sig`;

describe("parseEnv", () => {
  it("demo mode needs no Supabase variables", () => {
    const env = parseEnv({ ...base, NEXT_PUBLIC_DEMO_MODE: "true" });
    expect(env).toEqual({ isDemo: true, demoUrl: null, supabase: null });
  });

  it("live mode (default) requires the Supabase URL and publishable key", () => {
    expect(() => parseEnv(base)).toThrow(EnvError);
    try {
      parseEnv(base);
    } catch (e) {
      expect((e as EnvError).issues).toHaveLength(2);
    }
  });

  it("treats empty strings as unset", () => {
    expect(() =>
      parseEnv({
        ...base,
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " ",
      }),
    ).toThrow(EnvError);
  });

  it("parses a valid live configuration", () => {
    const env = parseEnv({
      ...base,
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_DEMO_URL: "https://personal-finances-demo.vercel.app",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
    });
    expect(env).toEqual({
      isDemo: false,
      demoUrl: "https://personal-finances-demo.vercel.app",
      supabase: { url: "http://127.0.0.1:54321", publishableKey: "sb_publishable_abc123" },
    });
  });

  it("accepts a legacy anon JWT", () => {
    const env = parseEnv({
      ...base,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyJwt("anon"),
    });
    expect(env.isDemo).toBe(false);
  });

  it.each([["sb_secret_abc123"], [legacyJwt("service_role")]])(
    "rejects secret keys (%#) and never echoes them",
    (key) => {
      try {
        parseEnv({
          ...base,
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(EnvError);
        expect((e as EnvError).message).toMatch(/secret\/service_role/);
        expect((e as EnvError).message).not.toContain(key);
      }
    },
  );

  it("rejects an invalid demo flag", () => {
    expect(() => parseEnv({ ...base, NEXT_PUBLIC_DEMO_MODE: "yes" })).toThrow(EnvError);
  });
});
