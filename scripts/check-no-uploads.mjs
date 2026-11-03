#!/usr/bin/env node
/**
 * T160 · No file uploads (FR-044, Principle I: no storage costs, nothing sensitive at rest).
 * Fails if the app code can receive files or the schema can store binaries:
 *  - src/: file inputs, FileReader, Supabase Storage;
 *  - supabase/migrations/: bytea columns.
 * Downloads (the CSV/ZIP export) are fine: they never leave the browser.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const RULES = [
  {
    root: "src",
    files: /\.(ts|tsx|js|jsx|mjs)$/,
    label: "file input",
    re: /type\s*=\s*\{?\s*["'`]file["'`]/,
  },
  { root: "src", files: /\.(ts|tsx|js|jsx|mjs)$/, label: "FileReader", re: /\bFileReader\b/ },
  {
    root: "src",
    files: /\.(ts|tsx|js|jsx|mjs)$/,
    label: "Supabase Storage",
    re: /\.storage\s*\.\s*from\s*\(|\bsupabase\.storage\b/,
  },
  {
    root: "supabase/migrations",
    files: /\.sql$/,
    label: "binary column (bytea)",
    re: /\bbytea\b/i,
  },
];

async function* walk(dir, pattern) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const path = join(dir, e.name);
    if (e.isDirectory()) yield* walk(path, pattern);
    else if (pattern.test(e.name)) yield path;
  }
}

const findings = [];
let scanned = 0;
for (const rule of RULES) {
  for await (const file of walk(rule.root, rule.files)) {
    scanned++;
    const lines = (await readFile(file, "utf8")).split("\n");
    lines.forEach((line, i) => {
      if (rule.re.test(line))
        findings.push(`${relative(process.cwd(), file)}:${i + 1} — ${rule.label}`);
    });
  }
}

if (findings.length > 0) {
  console.error(`✗ File uploads are not allowed (FR-044):`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `✓ No file uploads: ${scanned} file scans, no file inputs, FileReader, Storage or bytea.`,
);
