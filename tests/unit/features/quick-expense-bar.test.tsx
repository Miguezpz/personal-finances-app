/**
 * Spec 005 (T036) · QuickExpenseBar: privacy mode masks the button's amount (also in its
 * accessible name) but never the name (FR-015); an archived subcategory disables the button with
 * the reason (FR-011); it renders nothing without templates (FR-006a).
 */
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import type { FinanceSnapshot } from "@/domain/types";
import { QuickExpenseBar } from "@/features/expenses/QuickExpenseBar";
import { emptySnapshot, makeCategory, makeSubcategory, makeTemplate } from "../../utils/fixtures";
import { renderWithProviders } from "../../utils/renderWithProviders";

const transport = makeCategory({ name: "Transport", macro: "needs" });
const bus = makeSubcategory({ categoryId: transport.id, name: "Public transport" });
const template = makeTemplate({ name: "Transporte", amount: cents(2400), subcategoryId: bus.id });
const snapshot = (o: Partial<FinanceSnapshot> = {}) =>
  emptySnapshot({
    categories: [transport],
    subcategories: [bus],
    expenseTemplates: [template],
    ...o,
  });

describe("QuickExpenseBar", () => {
  it("shows name and amount with privacy off", async () => {
    renderWithProviders(<QuickExpenseBar />, {
      snapshot: snapshot(),
      preferences: { privacyMode: false },
    });
    const button = await screen.findByTestId(`quick-expense-${template.id}`);
    expect(button).toHaveTextContent("Transporte");
    expect(button).toHaveTextContent("$24.00");
    expect(button).toHaveAccessibleName("Record Transporte, $24.00");
  });

  it("masks the amount but not the name in privacy mode", async () => {
    renderWithProviders(<QuickExpenseBar />, {
      snapshot: snapshot(),
      preferences: { privacyMode: true },
    });
    const button = await screen.findByTestId(`quick-expense-${template.id}`);
    expect(button).toHaveTextContent("Transporte");
    expect(button).not.toHaveTextContent("24.00");
    expect(button.querySelector(".money")?.getAttribute("data-masked")).toBe("true");
    expect(button).toHaveAccessibleName("Record Transporte, Hidden amount");
  });

  it("disables a template whose subcategory is archived, with the reason", async () => {
    renderWithProviders(<QuickExpenseBar />, {
      snapshot: snapshot({ subcategories: [{ ...bus, archived: true }] }),
    });
    const button = await screen.findByTestId(`quick-expense-${template.id}`);
    expect(button).toBeDisabled();
    expect(button.closest("li")).toHaveAttribute("title", "Unavailable: its category is archived");
  });

  it("renders nothing without active templates", async () => {
    const { queryClient } = renderWithProviders(<QuickExpenseBar />, {
      snapshot: snapshot({ expenseTemplates: [{ ...template, archived: true }] }),
    });
    // Wait until the snapshot is loaded, so "nothing" isn't just "still loading".
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .some((q) => q.state.data),
    ).toBe(true);
    expect(screen.queryByTestId("quick-expense-bar")).toBeNull();
  });
});
