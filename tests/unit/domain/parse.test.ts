/**
 * Parsing user-typed amounts and percentages into integers WITHOUT floating point
 * (Principle II). Used by the income, rule and (later) expense forms.
 */
import { describe, expect, it } from "vitest";
import {
  formatBpsAsPercentInput,
  formatCentsAsInput,
  parseMoneyInput,
  parsePercentInput,
} from "@/domain/parse";

describe("parseMoneyInput", () => {
  it.each([
    ["20000", 2_000_000],
    ["20,000", 2_000_000],
    ["20,000.5", 2_000_050],
    ["20000.05", 2_000_005],
    ["$1,234.56", 123_456],
    [" 0.01 ", 1],
    ["0.1", 10],
    ["999999999.99", 99_999_999_999],
  ])("%s → %d cents", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each([[""], ["abc"], ["1.234"], ["1,23"], ["-5"], ["1e5"], ["12.3.4"], ["1,,000"]])(
    "rejects %j",
    (input) => {
      expect(parseMoneyInput(input)).toBeNull();
    },
  );

  it("never uses floating point (0.1 + 0.2 style inputs stay exact)", () => {
    expect(parseMoneyInput("0.29")).toBe(29);
    expect(parseMoneyInput("1.15")).toBe(115);
    expect(parseMoneyInput("4.35")).toBe(435);
  });
});

describe("parsePercentInput", () => {
  it.each([
    ["50", 5000],
    ["12.5", 1250],
    ["33.33", 3333],
    ["0", 0],
    ["100", 10_000],
    ["7.05", 705],
  ])("%s%% → %d bps", (input, expected) => {
    expect(parsePercentInput(input)).toBe(expected);
  });

  it.each([[""], ["101"], ["-1"], ["12.345"], ["abc"], ["50%%"]])("rejects %j", (input) => {
    expect(parsePercentInput(input)).toBeNull();
  });

  it("accepts a trailing % sign", () => {
    expect(parsePercentInput("20%")).toBe(2000);
  });
});

describe("formatters for form inputs", () => {
  it("round-trips cents and bps", () => {
    expect(formatCentsAsInput(2_000_050 as never)).toBe("20000.50");
    expect(formatCentsAsInput(7 as never)).toBe("0.07");
    expect(formatBpsAsPercentInput(1250 as never)).toBe("12.5");
    expect(formatBpsAsPercentInput(5000 as never)).toBe("50");
    expect(formatBpsAsPercentInput(3333 as never)).toBe("33.33");
  });
});
