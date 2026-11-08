import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch, presetRange } from "@/domain/ledger-presets";
import { d } from "../../utils/fixtures";

describe("presetRange (spec 009, FR-022)", () => {
  it.each([
    ["this-period", "2026-11-07", "2026-11-01", "2026-11-15"],
    ["this-period", "2026-11-20", "2026-11-16", "2026-11-30"],
    ["last-period", "2026-11-07", "2026-10-16", "2026-10-31"],
    ["last-period", "2026-01-05", "2025-12-16", "2025-12-31"],
    ["this-month", "2026-02-10", "2026-02-01", "2026-02-28"],
    ["last-month", "2026-03-10", "2026-02-01", "2026-02-28"],
    ["last-month", "2026-01-10", "2025-12-01", "2025-12-31"],
  ] as const)("%s on %s → %s..%s", (preset, today, from, to) => {
    expect(presetRange(preset, d(today))).toEqual({ from, to });
  });
});

describe("search", () => {
  it("ignores case and accents", () => {
    expect(normalizeSearch("  Café ÁRBOL ")).toBe("cafe arbol");
    expect(matchesSearch(["Café con leche", null], "CAFE")).toBe(true);
    expect(matchesSearch(["Uber al aeropuerto"], "uber aero")).toBe(true);
    expect(matchesSearch(["Uber"], "taxi")).toBe(false);
    expect(matchesSearch(["anything"], "  ")).toBe(true);
  });
});
