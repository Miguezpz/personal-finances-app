/** Spec 010 · motion hooks: flash on change, rows that appeared later, drag-to-dismiss threshold. */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  exitDurationMs,
  releaseVelocity,
  shouldDismiss,
} from "@/components/motion/use-drag-to-dismiss";
import { useFlashOnChange } from "@/components/motion/use-flash-on-change";
import { useNewRowIds } from "@/components/motion/use-new-row-ids";

describe("useFlashOnChange", () => {
  it("doesn't flash on the first render, then re-keys on each change", () => {
    const { result, rerender } = renderHook(({ v }) => useFlashOnChange(v), {
      initialProps: { v: 100 },
    });
    expect(result.current).toEqual({ key: 0, flashing: false });
    rerender({ v: 100 });
    expect(result.current.flashing).toBe(false);
    rerender({ v: 250 });
    expect(result.current).toEqual({ key: 1, flashing: true });
    rerender({ v: 300 });
    expect(result.current.key).toBe(2);
  });
});

describe("useNewRowIds", () => {
  it("nothing is new while loading or on the first load", () => {
    const { result, rerender } = renderHook(({ ids }) => useNewRowIds(ids), {
      initialProps: { ids: undefined as string[] | undefined },
    });
    expect(result.current.size).toBe(0);
    rerender({ ids: ["a", "b"] });
    expect(result.current.size).toBe(0);
    rerender({ ids: ["c", "a", "b"] });
    expect([...result.current]).toEqual(["c"]);
  });

  it("a row restored by Undo counts as new", () => {
    const { result, rerender } = renderHook(({ ids }) => useNewRowIds(ids), {
      initialProps: { ids: ["a", "b"] },
    });
    rerender({ ids: ["a"] });
    rerender({ ids: ["a", "b"] });
    // "b" was in the first load: it re-enters without the add animation, like the first load.
    expect(result.current.has("b")).toBe(false);
  });
});

describe("shouldDismiss (80 px or ≥ 0.5 px/ms)", () => {
  it.each([
    [81, 0, true],
    [80, 0, false],
    [30, 0.5, true],
    [30, 0.2, false],
    [0, 0, false],
  ])("distance %d, velocity %d → %s", (distance, velocity, expected) => {
    expect(shouldDismiss(distance, velocity)).toBe(expected);
  });
});

describe("exitDurationMs (rest of the sheet at the finger's speed, 120–260 ms)", () => {
  it.each([
    [400, 0, 260], // slow release: capped at the motion budget
    [200, 2, 120], // fast fling: never shorter than 120 ms
    [180, 1, 180], // follows the finger's speed in between
    [0, 0, 120],
  ])("remaining %d px at %d px/ms → %d ms", (remaining, velocity, expected) => {
    expect(exitDurationMs(remaining, velocity)).toBe(expected);
  });
});

describe("releaseVelocity (px/ms over the last 100 ms)", () => {
  const at = (pairs: [number, number][]) => pairs.map(([y, t]) => ({ y, t }));

  it("measures a real fling over the window", () => {
    expect(
      releaseVelocity(
        at([
          [0, 0],
          [25, 20],
          [50, 40],
          [80, 60],
        ]),
        65,
      ),
    ).toBeCloseTo(80 / 60);
  });

  it("ignores samples older than the window", () => {
    expect(
      releaseVelocity(
        at([
          [0, 0],
          [100, 200],
          [130, 260],
          [160, 300],
        ]),
        300,
      ),
    ).toBeCloseTo(0.6);
  });

  it("two events a millisecond apart can't fake a fling", () => {
    expect(
      releaseVelocity(
        at([
          [0, 0],
          [28, 400],
          [30, 401],
        ]),
        401,
      ),
    ).toBeLessThan(0.5);
  });

  it("is 0 when the finger rested before lifting", () => {
    expect(
      releaseVelocity(
        at([
          [0, 0],
          [50, 30],
        ]),
        200,
      ),
    ).toBe(0);
  });
});
