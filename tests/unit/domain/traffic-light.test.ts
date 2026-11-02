/**
 * T069 · Semáforo (FR-017): the base is allocated + max(carryIn, 0); green ≥ 50%, yellow 20–49%,
 * red < 20% or negative; base ≤ 0 → red if negative, neutral if 0. Thresholds are configurable.
 */
import { describe, expect, it } from "vitest";
import { bps, cents } from "@/domain/money";
import { trafficLight } from "@/domain/safe-to-spend";

const defaults = { greenMinBps: bps(5000), yellowMinBps: bps(2000) };
const light = (available: number, base: number, t = defaults) =>
  trafficLight(cents(available), cents(base), t);

describe("trafficLight", () => {
  it("green from 50% of the base", () => {
    expect(light(150_000, 300_000)).toBe("green");
    expect(light(300_000, 300_000)).toBe("green");
    expect(light(400_000, 300_000)).toBe("green");
  });

  it("yellow from 20% up to 49.99%", () => {
    expect(light(149_999, 300_000)).toBe("yellow");
    expect(light(60_000, 300_000)).toBe("yellow");
  });

  it("red below 20% and whenever negative", () => {
    expect(light(59_999, 300_000)).toBe("red");
    expect(light(0, 300_000)).toBe("red");
    expect(light(-1, 300_000)).toBe("red");
  });

  it("US2-7: $3,000 allocated + $1,000 carry (base $4,000) with $1,800 left is yellow (45%)", () => {
    expect(light(180_000, 400_000)).toBe("yellow");
  });

  it("base ≤ 0: neutral at 0, red when negative (no division by zero)", () => {
    expect(light(0, 0)).toBe("neutral");
    expect(light(-100, 0)).toBe("red");
    expect(light(0, -50)).toBe("neutral");
  });

  it("uses configurable thresholds", () => {
    const strict = { greenMinBps: bps(8000), yellowMinBps: bps(4000) };
    expect(light(70_000, 100_000, strict)).toBe("yellow");
    expect(light(30_000, 100_000, strict)).toBe("red");
    expect(light(80_000, 100_000, strict)).toBe("green");
  });

  it("stays exact with very large amounts", () => {
    expect(light(4_500_000_000_000, 9_000_000_000_000)).toBe("green");
    expect(light(4_499_999_999_999, 9_000_000_000_000)).toBe("yellow");
  });
});
