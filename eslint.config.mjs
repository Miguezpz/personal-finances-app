import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ---------------------------------------------------------------------------
// Constitution guard rails (see .specify/memory/constitution.md).
// In flat config a later block that sets the same rule REPLACES its options,
// so the selector lists below are composed per file scope instead of stacked.
// ---------------------------------------------------------------------------

/** FR-044 / Principle I: no file uploads anywhere. */
const NO_FILE_INPUT = {
  selector:
    "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='file']",
  message: "File inputs are forbidden (FR-044: text and numbers only, no uploads).",
};

/** Principle V: every amount goes through <Money> / src/i18n/format.ts, so privacy masking can't be bypassed. */
const NO_CURRENCY_FORMAT = [
  {
    selector:
      "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat'] Property[key.name='style'][value.value='currency']",
    message: "Format money only in src/i18n/format.ts (render it with <Money>).",
  },
  {
    selector:
      "CallExpression[callee.object.name='Intl'][callee.property.name='NumberFormat'] Property[key.name='style'][value.value='currency']",
    message: "Format money only in src/i18n/format.ts (render it with <Money>).",
  },
  {
    selector:
      "CallExpression[callee.property.name='toLocaleString'] Property[key.name='style'][value.value='currency']",
    message: "Format money only in src/i18n/format.ts (render it with <Money>).",
  },
];

/** Principle IV: UI and hooks ask for `capabilities`, never for the active provider type. */
const PROVIDER_MODE_ALLOWED = [
  "src/data/index.ts",
  "src/lib/env.ts",
  "src/middleware.ts",
  "src/proxy.ts", // Next >= 16 name for middleware
  // Server route without a DataProvider: decides demo/live at build time like proxy.ts
  // (specs/002-google-sign-in/plan.md, Complexity Tracking).
  "src/app/auth/callback/route.ts",
  "src/app/page.tsx",
  "src/components/layout/DemoBanner.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project:
    ".next-e2e-*/**", // e2e builds, one per mode (playwright.config.ts)
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "supabase/.temp/**",
    "specs/**", // design contracts, copied into src/ when implemented
    ".specify/**",
    ".claude/**",
    "src/data/supabase/database.types.ts", // generated
  ]),

  // Principle II: strict typing everywhere.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": "allow-with-description",
          "ts-expect-error": "allow-with-description",
          "ts-nocheck": true,
          minimumDescriptionLength: 10,
        },
      ],
    },
  },

  // Application code.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Principle V: no logging that could leak amounts or personal data.
      "no-console": "error",
      "no-restricted-syntax": ["error", NO_FILE_INPUT, ...NO_CURRENCY_FORMAT],
      // Principle IV: only src/data/supabase/** may talk to Supabase.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*"],
              message:
                "Only src/data/supabase/** may import @supabase/*. Use the DataProvider (useDataProvider) instead.",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "provider",
          property: "mode",
          message: "Ask provider.capabilities (e.g. canWrite) instead of the provider type.",
        },
        {
          object: "env",
          property: "isDemo",
          message: "Ask provider.capabilities (e.g. canWrite) instead of checking demo mode.",
        },
      ],
    },
  },
  {
    // Principle VI / FR-039: every visible text comes from the EN/ES dictionaries (T117).
    // Only punctuation and symbols may be written literally in JSX.
    files: ["src/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: ["·", " · ", "%", "#", "—", "–", "…", ":", "•", "+", "-", "/", "(", ")"],
        },
      ],
    },
  },
  {
    files: ["src/data/supabase/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: PROVIDER_MODE_ALLOWED,
    rules: { "no-restricted-properties": "off" },
  },
  {
    // Playwright fixtures call `use()`, which is not React's hook.
    files: ["tests/e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // The single place allowed to build currency formatters.
    files: ["src/i18n/format.ts"],
    rules: { "no-restricted-syntax": ["error", NO_FILE_INPUT] },
  },
]);

export default eslintConfig;
