import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * Quality gate from the constitution: every feature is verified in demo and live mode, in EN and ES.
 * Four projects: demo-en, demo-es, live-en, live-es.
 *
 * - demo-* run against a server built with NEXT_PUBLIC_DEMO_MODE=true (Mock Data Provider, no Supabase).
 * - live-* run against a server built with NEXT_PUBLIC_DEMO_MODE=false, backed by local Supabase
 *   (`pnpm exec supabase start`; NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY must be set).
 * - The language is fixed per project with the NEXT_LOCALE cookie.
 *
 * Local runs without Docker/Supabase: `E2E_MODES=demo pnpm test:e2e` (only the demo server starts).
 * CI runs all four projects; any failing project fails the build.
 */

type Mode = "demo" | "live";
type Locale = "en" | "es";

const isCI = !!process.env.CI;
const MODES: Mode[] = (process.env.E2E_MODES ?? "demo,live")
  .split(",")
  .map((m) => m.trim())
  .filter((m): m is Mode => m === "demo" || m === "live");
const LOCALES: Locale[] = ["en", "es"];

const PORTS: Record<Mode, number> = { demo: 3100, live: 3200 };
const baseURL = (mode: Mode) => `http://localhost:${PORTS[mode]}`;

const projects: Project[] = MODES.flatMap((mode) =>
  LOCALES.map((locale): Project => ({
    name: `${mode}-${locale}`,
    // Untagged tests run in all four projects (matrix.spec.ts, P1 flows, toggles).
    // A story-specific spec declares its mode with a tag:
    //   test.describe("US1 income split", { tag: "@live" }, ...)  → live-en + live-es only
    //   test.describe("US9 demo read-only", { tag: "@demo" }, ...) → demo-en + demo-es only
    grepInvert: mode === "demo" ? /@live\b/ : /@demo\b/,
    use: {
      ...devices["Desktop Chrome"],
      baseURL: baseURL(mode),
      locale: locale === "en" ? "en-US" : "es-MX",
      timezoneId: "America/Mexico_City",
      storageState: {
        cookies: [
          {
            name: "NEXT_LOCALE",
            value: locale,
            domain: "localhost",
            path: "/",
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      },
    },
    metadata: { mode, locale },
  })),
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    // Keep evidence of every failure (also locally, where there are no retries): an intermittent
    // failure must be diagnosable from its trace instead of guessed at.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects,
  webServer: MODES.map((mode) => ({
    // CI tests the production build; locally the dev server is enough and is reused if already up.
    command: isCI
      ? `pnpm build && pnpm start --port ${PORTS[mode]}`
      : `pnpm dev --port ${PORTS[mode]}`,
    url: baseURL(mode),
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_DEMO_MODE: mode === "demo" ? "true" : "false",
      NEXT_DIST_DIR: `.next-e2e-${mode}`,
    },
  })),
});
