/**
 * SpendingByMethod: cash and cards always show (even at $0), other accounts only when used,
 * rows ordered by kind, "unspecified" and the total, and ‹ › moving between quincenas (the
 * navigator lives in the Expenses header since spec 009; the harness wires both together).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { periodOf, previousPeriod, todayIn } from "@/domain/periods";
import { DEFAULT_TIMEZONE } from "@/domain/settings";
import { useState } from "react";
import type { Period } from "@/domain/types";
import { PeriodNavigator, SpendingByMethod } from "@/features/expenses/SpendingByMethod";
import { emptySnapshot, makeAccount, makeCard, makeExpense } from "../../utils/fixtures";
import { renderWithProviders } from "../../utils/renderWithProviders";

const current = periodOf(todayIn(DEFAULT_TIMEZONE, new Date()));
const previous = previousPeriod(current);

const cash = makeAccount({ kind: "cash", name: "Efectivo" });
const nu = makeCard({ name: "Nu" });
const bbva = makeCard({ name: "BBVA" });
const debit = makeAccount({ kind: "checking", name: "Santander" });
const savings = makeAccount({ kind: "savings", name: "Ahorro" });

function WithNavigator() {
  const [period, setPeriod] = useState<Period>(current);
  return (
    <>
      <PeriodNavigator period={period} onChange={setPeriod} />
      <SpendingByMethod period={period} />
    </>
  );
}

const rowsOf = () =>
  screen.getAllByTestId("spending-row").map((r) => ({
    account: r.getAttribute("data-account"),
    text: r.textContent,
  }));

describe("SpendingByMethod", () => {
  it("shows cash and cards at $0 and hides unused debit and savings", async () => {
    renderWithProviders(<SpendingByMethod period={current} />, {
      snapshot: emptySnapshot({ accounts: [debit, nu, savings, cash, bbva] }),
    });
    await screen.findAllByTestId("spending-row");
    expect(rowsOf().map((r) => r.account)).toEqual([cash.id, bbva.id, nu.id]);
    expect(rowsOf().every((r) => r.text?.includes("$0.00"))).toBe(true);
    expect(screen.getByTestId("spending-total")).toHaveTextContent("$0.00");
  });

  it("sums the current quincena by method, in kind order, with unspecified last", async () => {
    renderWithProviders(<SpendingByMethod period={current} />, {
      snapshot: emptySnapshot({
        accounts: [debit, nu, cash],
        expenses: [
          makeExpense({ spentOn: current.start, amount: cents(12_400), paymentAccountId: cash.id }),
          makeExpense({ spentOn: current.start, amount: cents(5_000), paymentAccountId: nu.id }),
          makeExpense({ spentOn: current.start, amount: cents(4_100), paymentAccountId: debit.id }),
          makeExpense({ spentOn: current.start, amount: cents(950), paymentAccountId: null }),
          makeExpense({
            spentOn: previous.start,
            amount: cents(99_900),
            paymentAccountId: cash.id,
          }),
        ],
      }),
    });
    await screen.findAllByTestId("spending-row");
    expect(rowsOf()).toEqual([
      { account: cash.id, text: expect.stringContaining("$124.00") },
      { account: nu.id, text: expect.stringContaining("$50.00") },
      { account: debit.id, text: expect.stringContaining("$41.00") },
      { account: "none", text: expect.stringContaining("$9.50") },
    ]);
    expect(screen.getByTestId("spending-total")).toHaveTextContent("$224.50");
  });

  it("moves to the previous quincena and back; › is disabled on the current one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WithNavigator />, {
      snapshot: emptySnapshot({
        accounts: [cash],
        expenses: [
          makeExpense({ spentOn: previous.end, amount: cents(30_000), paymentAccountId: cash.id }),
        ],
      }),
    });
    const section = await screen.findByTestId("spending-by-method");
    await screen.findByTestId("spending-total");
    const nav = screen.getByTestId("expenses-period");
    const next = within(nav).getByRole("button", { name: "Next quincena" });
    expect(next).toBeDisabled();
    expect(section).toHaveAttribute("data-period", current.key);
    expect(screen.getByTestId("spending-total")).toHaveTextContent("$0.00");

    await user.click(within(nav).getByRole("button", { name: "Previous quincena" }));
    expect(section).toHaveAttribute("data-period", previous.key);
    expect(screen.getByTestId("spending-total")).toHaveTextContent("$300.00");
    expect(next).toBeEnabled();

    await user.click(next);
    expect(section).toHaveAttribute("data-period", current.key);
    expect(next).toBeDisabled();
  });
});
