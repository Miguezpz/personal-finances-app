/**
 * T165 · SC-013: the full CSV export of 5 years of history is generated in under 10 s (in the
 * browser it's the same pure code), with exactly one ledger row per movement.
 */
import { describe, expect, it } from "vitest";
import { generateHistory } from "@/data/mock/seed";
import { snapshotToCsvBundle } from "@/domain/csv";
import { buildLedger } from "@/domain/ledger";
import { createZip } from "@/lib/zip";

describe("export · 5 years of history", () => {
  const s = generateHistory(5);

  it("builds every CSV and the ZIP in under 10 s, one ledger row per movement", () => {
    const start = performance.now();
    const bundle = snapshotToCsvBundle(s);
    const zip = createZip(bundle, new Date("2026-11-01T00:00:00Z"));
    const ms = performance.now() - start;

    expect(ms).toBeLessThan(10_000);
    expect(zip.length).toBeGreaterThan(0);
    const ledgerRows = (bundle["ledger.csv"] as string).slice(1).trimEnd().split("\r\n").length - 1;
    expect(ledgerRows).toBe(buildLedger(s).length);
    const expenseRows =
      (bundle["expenses.csv"] as string).slice(1).trimEnd().split("\r\n").length - 1;
    expect(expenseRows).toBe(s.expenses.length);
  });
});
