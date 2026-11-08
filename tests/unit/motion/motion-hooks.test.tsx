/** Spec 010 · motion hooks: flash on change, rows that appeared later, drag-to-dismiss threshold. */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { shouldDismiss } from "@/components/motion/use-drag-to-dismiss";
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
