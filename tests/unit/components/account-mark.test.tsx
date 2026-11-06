/**
 * <AccountMark>: the bank's logo tile, a monogram for a known bank without a logo file, or the
 * generic icon of the account kind. Always decorative (the name is next to it).
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountMark } from "@/components/icons/AccountMark";

describe("AccountMark", () => {
  it("shows the bank's logo tile", () => {
    const { container } = render(
      <AccountMark account={{ kind: "credit_card", name: "BBVA Blue CC", institution: "BBVA" }} />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/logos/bbva.svg");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows a monogram for a known bank without a logo file", () => {
    const { container } = render(
      <AccountMark account={{ kind: "savings", name: "Ahorro", institution: "Openbank" }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    const svg = container.querySelector('svg[data-institution="openbank"]');
    expect(svg?.textContent).toBe("O");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("falls back to the generic icon of the kind", () => {
    const { container } = render(
      <AccountMark account={{ kind: "cash", name: "Efectivo", institution: null }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-institution]")).toBeNull();
    expect(container.querySelector("svg.lucide")).not.toBeNull();
  });
});
