#!/usr/bin/env node
/**
 * Runs a command with the LOCAL Supabase credentials exported (dev/test only).
 *   node scripts/with-local-supabase.mjs pnpm test:contract
 * Reads `supabase status -o json`; requires `pnpm exec supabase start` to be running.
 * These are the well-known local development keys, never the cloud project's.
 */
import { execFileSync, spawnSync } from "node:child_process";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/with-local-supabase.mjs <command> [...args]");
  process.exit(2);
}

let status;
try {
  status = JSON.parse(
    execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
} catch {
  console.error("Local Supabase is not running. Start it with: pnpm exec supabase start");
  process.exit(1);
}

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_TEST_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
};

const result = spawnSync(cmd, args, { stdio: "inherit", env });
process.exit(result.status ?? 1);
