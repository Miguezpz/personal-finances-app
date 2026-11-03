import { z } from "zod";

/**
 * Validated public environment.
 *
 * NEXT_PUBLIC_* values are inlined by Next at build time, so they MUST be read with static
 * `process.env.NAME` expressions (see `readRawEnv`). Error messages never include values.
 */

export type Env =
  | {
      readonly isDemo: true;
      readonly demoUrl: string | null;
      readonly supabase: null;
    }
  | {
      readonly isDemo: false;
      readonly demoUrl: string | null;
      readonly supabase: { readonly url: string; readonly publishableKey: string };
    };

type EnvKey =
  | "NEXT_PUBLIC_DEMO_MODE"
  | "NEXT_PUBLIC_DEMO_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

export type RawEnv = Readonly<Record<EnvKey, string | undefined>>;

/** `KEY=` in a .env file yields "", which should behave like "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema.optional(),
  );

/** Principle III: the client bundle must never carry a secret / service_role key. */
function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) return false; // not a legacy JWT key
  try {
    const payload: unknown = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return (
      typeof payload === "object" &&
      payload !== null &&
      "role" in payload &&
      payload.role === "service_role"
    );
  } catch {
    return false;
  }
}

const schema = z
  .object({
    NEXT_PUBLIC_DEMO_MODE: optional(z.enum(["true", "false"])),
    NEXT_PUBLIC_DEMO_URL: optional(z.url()),
    NEXT_PUBLIC_SUPABASE_URL: optional(z.url()),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional(z.string()),
  })
  .superRefine((value, ctx) => {
    if (value.NEXT_PUBLIC_DEMO_MODE === "true") return; // demo never needs Supabase
    if (!value.NEXT_PUBLIC_SUPABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message: "Required when NEXT_PUBLIC_DEMO_MODE is not 'true'.",
      });
    }
    const key = value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!key) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
        message: "Required when NEXT_PUBLIC_DEMO_MODE is not 'true'.",
      });
    } else if (isSecretKey(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
        message: "This is a secret/service_role key. Only the publishable key may be exposed.",
      });
    }
  });

export class EnvError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Invalid environment configuration:\n- ${issues.join("\n- ")}`);
    this.name = "EnvError";
  }
}

export function parseEnv(raw: RawEnv): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    );
  }
  const v = result.data;
  const demoUrl = v.NEXT_PUBLIC_DEMO_URL ?? null;

  if (v.NEXT_PUBLIC_DEMO_MODE === "true") {
    return { isDemo: true, demoUrl, supabase: null };
  }
  // superRefine guarantees both values in live mode.
  return {
    isDemo: false,
    demoUrl,
    supabase: {
      url: v.NEXT_PUBLIC_SUPABASE_URL as string,
      publishableKey: v.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    },
  };
}

function readRawEnv(): RawEnv {
  // Static references so Next can inline them into the client bundle. In a demo build
  // NEXT_PUBLIC_DEMO_MODE is the constant "true", so the minifier drops the Supabase branches:
  // even if those variables are set on the demo deployment, they never reach its bundle
  // (Principle IV, checked by scripts/check-demo-bundle.mjs).
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  return {
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    NEXT_PUBLIC_DEMO_URL: process.env.NEXT_PUBLIC_DEMO_URL,
    NEXT_PUBLIC_SUPABASE_URL: demo ? undefined : process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: demo
      ? undefined
      : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

let cached: Env | undefined;

/** Lazily parsed so a misconfigured live build fails loudly on first use, not at import time in tests. */
export function getEnv(): Env {
  cached ??= parseEnv(readRawEnv());
  return cached;
}

/**
 * Convenience accessor. `env.isDemo` is lint-restricted to the composition root
 * (src/data/index.ts, middleware/proxy, landing, DemoBanner); everything else asks
 * `provider.capabilities`.
 */
export const env = {
  get isDemo(): boolean {
    return getEnv().isDemo;
  },
  get demoUrl(): string | null {
    return getEnv().demoUrl;
  },
  get supabase(): Env["supabase"] {
    return getEnv().supabase;
  },
};
