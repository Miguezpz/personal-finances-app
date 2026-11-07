/**
 * Spec 007 · AccountForm › CardTermsFields: card terms from a statement's dates, the next 3
 * statements, warnings, translated errors, prefill on edit and the manual mode.
 */
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountForm } from "@/features/settings/accounts/AccountForm";
import { emptySnapshot, makeCard } from "../../utils/fixtures";
import { renderWithProviders } from "../../utils/renderWithProviders";

beforeEach(() => {
  // Nov 7, 2026, midday in Mexico City.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-07T18:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const bbva = makeCard({ name: "BBVA", cutOffDay: 5, paymentDueOffsetDays: 20 });

function renderForm(account: typeof bbva | null = null, locale: "en" | "es" = "en") {
  return renderWithProviders(
    <AccountForm open onOpenChange={() => {}} account={account} takenNames={[]} />,
    { snapshot: emptySnapshot({ accounts: account ? [account] : [] }), locale },
  );
}

const setDate = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const rows = () =>
  within(screen.getByTestId("card-upcoming-statements"))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

describe("CardTermsFields", () => {
  it("derives the day and the days to pay from a statement and lists the next 3", async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/^type$/i), "credit_card");
    setDate(/statement date/i, "2026-11-22");
    setDate(/payment due date/i, "2026-12-07");
    expect(screen.getByTestId("card-terms-summary")).toHaveTextContent(
      "Cut-off on day 22 · due 15 days later",
    );
    expect(rows()).toHaveLength(3);
    expect(rows()[0]).toContain("Nov 22, 2026");
    expect(rows()[0]).toContain("Dec 7, 2026");
  });

  it("shows the translated error for an invalid statement", async () => {
    renderForm(null, "es");
    await userEvent.selectOptions(screen.getByLabelText(/^tipo$/i), "credit_card");
    setDate(/fecha de corte/i, "2026-11-22");
    setDate(/fecha límite/i, "2026-11-20");
    expect(screen.getByTestId("card-statement-error")).toHaveTextContent(
      "La fecha límite debe ser después del corte.",
    );
    expect(screen.queryByTestId("card-upcoming-statements")).toBeNull();
  });

  it("prefills an existing card with its latest statement and marks moved due dates", () => {
    renderForm(bbva);
    expect(screen.getByLabelText(/statement date/i)).toHaveValue("2026-11-05");
    expect(screen.getByLabelText(/payment due date/i)).toHaveValue("2026-11-25");
    const [first, second, third] = rows();
    expect(first).toContain("Nov 25, 2026");
    expect(second).toContain("Dec 24, 2026"); // Dec 25 is a bank holiday
    expect(second).toContain("moved for a non-business day");
    expect(third).toContain("Jan 25, 2027");
  });

  it("warns, without blocking, when the due date may have been moved", () => {
    renderForm(makeCard({ name: "Nu", cutOffDay: 23, paymentDueOffsetDays: 11 }));
    setDate(/statement date/i, "2026-09-23");
    setDate(/payment due date/i, "2026-10-05");
    expect(screen.getByTestId("card-statement-warnings")).toHaveTextContent(/may have been moved/);
    expect(screen.getByTestId("card-terms-summary")).toHaveTextContent("day 23 · due 12 days");
  });

  it("switches to the numbers by hand, keeping the terms and the preview", async () => {
    renderForm(bbva);
    await userEvent.click(screen.getByRole("button", { name: /enter the numbers manually/i }));
    expect(screen.getByLabelText(/cut-off day/i)).toHaveValue("5");
    expect(screen.getByLabelText(/days to pay/i)).toHaveValue("20");
    expect(rows()).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /use statement dates/i }));
    expect(screen.getByLabelText(/statement date/i)).toHaveValue("2026-11-05");
  });
});
