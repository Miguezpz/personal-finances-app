import { describe, expect, it } from "vitest";
import {
  isSecondaryRoute,
  MOBILE_BAR_ITEMS,
  NAV_GROUPS,
  SECONDARY_NAV_GROUPS,
} from "@/components/layout/nav-items";

describe("nav-items (spec 008)", () => {
  it("groups the destinations in the agreed order", () => {
    expect(NAV_GROUPS.map((g) => [g.id, g.items.map((i) => i.href)])).toEqual([
      ["main", ["/dashboard", "/expenses", "/income", "/credit"]],
      ["plan", ["/recurring", "/goals"]],
      ["debts", ["/receivables"]],
      ["insights", ["/ledger", "/net-worth"]],
      ["footer", ["/settings"]],
    ]);
  });

  it("puts Home, Expenses and Credit in the bottom bar", () => {
    expect(MOBILE_BAR_ITEMS.map((i) => i.href)).toEqual(["/dashboard", "/expenses", "/credit"]);
  });

  it("lists every other destination in the More panel, Income under main", () => {
    expect(SECONDARY_NAV_GROUPS.map((g) => [g.id, g.items.map((i) => i.href)])).toEqual([
      ["main", ["/income"]],
      ["plan", ["/recurring", "/goals"]],
      ["debts", ["/receivables"]],
      ["insights", ["/ledger", "/net-worth"]],
      ["footer", ["/settings"]],
    ]);
  });

  it.each([
    ["/goals", true],
    ["/settings/rules", true],
    ["/income", true],
    ["/expenses", false],
    ["/credit", false],
    ["/dashboard", false],
    ["/expenses-archive", true],
  ])("isSecondaryRoute(%s) = %s", (path, expected) => {
    expect(isSecondaryRoute(path)).toBe(expected);
  });
});
