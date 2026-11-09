/**
 * Dashboard card notice (enmienda 2026-11-09 a spec 011 FR-029): one line that counts the cards to
 * pay soon — due within 7 days, overdue, or pending in a session starting within 7 days — each card
 * once, red when any is overdue, linking to Credit. The statement hooks are mocked, so this only
 * tests the counting.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardDueAlerts } from "@/features/safe-to-spend/CardDueAlerts";
import { d, makeCard } from "../../utils/fixtures";
import { renderWithProviders } from "../../utils/renderWithProviders";

const state = vi.hoisted(() => ({ statements: [] as unknown[], next: null as unknown }));
vi.mock("@/lib/use-today", () => ({ useToday: () => "2026-11-09" }));
vi.mock("@/features/credit/use-card-statements", () => ({
  useCardStatements: () => state.statements,
  usePaymentSession: () => ({ next: state.next }),
}));

const overdue = makeCard({ name: "Nu" });
const dueSoon = makeCard({ name: "BBVA" });
const later = makeCard({ name: "Amex" });
const statement = (card: typeof overdue, last: { state: string; due: string }) => ({
  card,
  summary: { last: { ...last, due: d(last.due) } },
});

beforeEach(() => {
  state.statements = [];
  state.next = null;
});

describe("CardDueAlerts", () => {
  it("renders nothing when no card is due", () => {
    state.statements = [statement(later, { state: "pending", due: "2026-12-09" })];
    renderWithProviders(<CardDueAlerts />);
    expect(screen.queryByTestId("card-due-alerts")).toBeNull();
  });

  it("counts an overdue card that is also in the session once, and links to Credit", () => {
    state.statements = [
      statement(overdue, { state: "overdue", due: "2026-11-05" }),
      statement(dueSoon, { state: "pending", due: "2026-11-12" }),
      statement(later, { state: "pending", due: "2026-12-09" }),
    ];
    state.next = {
      phase: "upcoming",
      window: { start: d("2026-11-12"), end: d("2026-11-14") },
      cards: [
        { card: overdue, statement: { state: "overdue" } },
        { card: dueSoon, statement: { state: "pending" } },
      ],
    };
    renderWithProviders(<CardDueAlerts />);
    const notice = screen.getByTestId("card-due-alerts");
    expect(notice).toHaveAttribute("data-count", "2");
    expect(notice).toHaveTextContent("2 cards to pay, some overdue");
    expect(screen.getByTestId("card-due-see-credit")).toHaveAttribute("href", "/credit");
  });
});
