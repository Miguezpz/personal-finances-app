/**
 * First Load JS of `/` and `/dashboard` (spec 003, SC-006): gzip size of every <script src> that the
 * prerendered HTML loads. Next 16's build table no longer prints "First Load JS", so the budget is
 * measured from the build output instead.
 *
 * Usage: pnpm build && node scripts/measure-first-load.mjs [distDir=.next]
 */
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const dist = process.argv[2] ?? process.env.NEXT_DIST_DIR ?? ".next";

for (const [route, file] of [
  ["/", "index"],
  ["/dashboard", "dashboard"],
]) {
  const html = readFileSync(`${dist}/server/app/${file}.html`, "utf8");
  const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
  let raw = 0;
  let gz = 0;
  for (const src of srcs) {
    const path = `${dist}/${src.replace(/^\/_next\//, "").split("?")[0]}`;
    if (!existsSync(path)) throw new Error(`Script not found in the build: ${path}`);
    const bytes = readFileSync(path);
    raw += bytes.length;
    gz += gzipSync(bytes, { level: 9 }).length;
  }
  console.log(
    `${route}: ${srcs.length} scripts, ${(raw / 1024).toFixed(1)} kB raw, ${(gz / 1024).toFixed(1)} kB gzip`,
  );
}
