import { describe, expect, it } from "vitest";
import { recentSubcategories } from "@/domain/recent";
import { d, makeExpense, makeSubcategory } from "../../utils/fixtures";

describe("recentSubcategories (spec 009, FR-005)", () => {
  const subs = ["a", "b", "c", "d", "e", "f", "g"].map((name) => makeSubcategory({ name }));
  const [a, b, c, , , , g] = subs as [
    (typeof subs)[0],
    (typeof subs)[0],
    (typeof subs)[0],
    unknown,
    unknown,
    unknown,
    (typeof subs)[0],
  ];
  const on = (sub: { id: string }, date: string) =>
    makeExpense({ subcategoryId: sub.id as never, spentOn: d(date) });

  it("newest first, distinct, at most n", () => {
    const expenses = [
      on(a, "2026-11-01"),
      on(b, "2026-11-03"),
      on(a, "2026-11-05"),
      on(c, "2026-11-04"),
    ];
    expect(recentSubcategories(expenses, subs, 2).map((s) => s.name)).toEqual(["a", "c"]);
  });

  it("on the same date, the later recorded wins", () => {
    const expenses = [on(a, "2026-11-05"), on(b, "2026-11-05")];
    expect(recentSubcategories(expenses, subs).map((s) => s.name)).toEqual(["b", "a"]);
  });

  it("skips archived subcategories", () => {
    const archived = { ...g, archived: true };
    const list = subs.map((s) => (s.id === g.id ? archived : s));
    expect(
      recentSubcategories([on(g, "2026-11-06"), on(a, "2026-11-01")], list).map((s) => s.name),
    ).toEqual(["a"]);
  });

  it("no history → no chips", () => {
    expect(recentSubcategories([], subs)).toEqual([]);
  });
});
