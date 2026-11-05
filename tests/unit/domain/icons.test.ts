/**
 * Spec 004 (T008): curated icon keys, income types and the icon resolution order
 * subcategory → category → generic (Clarification A, FR-013).
 */
import { describe, expect, it } from "vitest";
import {
  CATEGORY_ICON_KEYS,
  ICON_KEY_FORMAT,
  isCategoryIconKey,
  isValidIconKeyFormat,
  resolveTaxonomyIcon,
} from "@/domain/icons";
import { INCOME_TYPES, isIncomeType } from "@/domain/income-types";

describe("curated icon keys", () => {
  it("are unique and pass the database format check", () => {
    expect(new Set(CATEGORY_ICON_KEYS).size).toBe(CATEGORY_ICON_KEYS.length);
    for (const key of CATEGORY_ICON_KEYS) {
      expect(key).toMatch(ICON_KEY_FORMAT);
      expect(isValidIconKeyFormat(key)).toBe(true);
    }
  });

  it("offer about 40 icons", () => {
    expect(CATEGORY_ICON_KEYS.length).toBeGreaterThanOrEqual(36);
    expect(CATEGORY_ICON_KEYS.length).toBeLessThanOrEqual(44);
  });

  it("validate the format like the database", () => {
    expect(isValidIconKeyFormat("gamepad-2")).toBe(true);
    expect(isValidIconKeyFormat("Plug")).toBe(false);
    expect(isValidIconKeyFormat("a b")).toBe(false);
    expect(isValidIconKeyFormat("-x")).toBe(false);
    expect(isValidIconKeyFormat("a".repeat(41))).toBe(false);
  });

  it("recognise only curated keys", () => {
    expect(isCategoryIconKey("plug")).toBe(true);
    expect(isCategoryIconKey("rocket")).toBe(false);
    expect(isCategoryIconKey(null)).toBe(false);
  });
});

describe("resolveTaxonomyIcon", () => {
  it("uses the subcategory's own icon first", () => {
    expect(resolveTaxonomyIcon({ icon: "coffee" }, { icon: "utensils" })).toBe("coffee");
  });

  it("inherits the category icon when the subcategory has none", () => {
    expect(resolveTaxonomyIcon({ icon: null }, { icon: "utensils" })).toBe("utensils");
  });

  it("falls back to the generic icon when neither has one", () => {
    expect(resolveTaxonomyIcon({ icon: null }, { icon: null })).toBe("generic");
    expect(resolveTaxonomyIcon(null, null)).toBe("generic");
  });

  it("skips unknown keys stored in the database", () => {
    expect(resolveTaxonomyIcon({ icon: "rocket" }, { icon: "tv" })).toBe("tv");
    expect(resolveTaxonomyIcon({ icon: null }, { icon: "rocket" })).toBe("generic");
  });

  it("resolves a category on its own", () => {
    expect(resolveTaxonomyIcon(null, { icon: "house" })).toBe("house");
  });
});

describe("income types", () => {
  it("are the 9 fixed values in the enum's order", () => {
    expect(INCOME_TYPES).toEqual([
      "salary",
      "gift",
      "debt_repayment",
      "cashback",
      "extra",
      "sales",
      "savings",
      "investment_returns",
      "other",
    ]);
    expect(isIncomeType("salary")).toBe(true);
    expect(isIncomeType("bonus")).toBe(false);
    expect(isIncomeType("")).toBe(false);
  });
});
