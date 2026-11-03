#!/usr/bin/env node
/**
 * T136 · Demo bundle isolation (Principle IV, FR-046). Run after `next build` with
 * NEXT_PUBLIC_DEMO_MODE=true: fails if anything shipped to the browser contains Supabase code,
 * a Supabase URL or an API key. Only the pattern and file are printed — never the match itself,
 * so a leaked key doesn't end up in CI logs.
 *
 * Scans <distDir>/static (client JS/CSS) and the prerendered HTML / RSC payloads in
 * <distDir>/server/app. distDir = NEXT_DIST_DIR or ".next" (same rule as next.config.ts).
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const distDir = process.env.NEXT_DIST_DIR || ".next";

const FORBIDDEN = [
  ["Supabase project URL", /[a-z0-9-]+\.supabase\.(co|in|net)/i],
  ["@supabase/* package", /@supabase\//],
  ["supabase-js client code", /\b(GoTrueClient|PostgrestClient|SupabaseClient|RealtimeClient)\b/],
  ["local Supabase API URL", /(127\.0\.0\.1|localhost):54321/],
  ["Supabase publishable key", /sb_publishable_[A-Za-z0-9_-]{8,}/],
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{8,}/],
  [
    "JWT (legacy anon/service key)",
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  ],
  ["service_role reference", /service_role/],
];

const SCANNED = /\.(js|mjs|css|html|rsc|json|txt|map)$/;

async function* files(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const path = join(dir, e.name);
    if (e.isDirectory()) yield* files(path);
    else if (SCANNED.test(e.name)) yield path;
  }
}

async function main() {
  const staticDir = join(distDir, "static");
  try {
    await stat(staticDir);
  } catch {
    console.error(
      `✗ ${staticDir} not found. Build the demo first: NEXT_PUBLIC_DEMO_MODE=true pnpm build`,
    );
    process.exit(2);
  }

  let scanned = 0;
  const findings = [];
  for (const root of [staticDir, join(distDir, "server", "app")]) {
    for await (const file of files(root)) {
      scanned++;
      const text = await readFile(file, "utf8");
      for (const [label, re] of FORBIDDEN) {
        if (re.test(text)) findings.push(`${relative(process.cwd(), file)} — ${label}`);
      }
    }
  }

  if (scanned === 0) {
    console.error(`✗ No files scanned under ${distDir}.`);
    process.exit(2);
  }
  if (findings.length > 0) {
    console.error(
      `✗ The demo bundle is not isolated from Supabase (${findings.length} finding(s)):`,
    );
    for (const f of findings) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`✓ Demo bundle clean: ${scanned} files scanned, no Supabase code, URLs or keys.`);
}

await main();
