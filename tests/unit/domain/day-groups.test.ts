import { describe, expect, it } from "vitest";
import { groupByDay } from "@/domain/day-groups";
import { d } from "../../utils/fixtures";

describe("groupByDay (spec 009, FR-016)", () => {
  it("labels today and yesterday and keeps order", () => {
    const rows = [
      { id: 1, date: d("2026-11-07") },
      { id: 2, date: d("2026-11-07") },
      { id: 3, date: d("2026-11-06") },
      { id: 4, date: d("2026-11-02") },
    ];
    expect(
      groupByDay(rows, d("2026-11-07")).map((g) => [g.label, g.rows.map((r) => r.id)]),
    ).toEqual([
      ["today", [1, 2]],
      ["yesterday", [3]],
      ["date", [4]],
    ]);
  });

  it("across a month boundary", () => {
    expect(groupByDay([{ date: d("2026-10-31") }], d("2026-11-01"))[0]?.label).toBe("yesterday");
  });
});
