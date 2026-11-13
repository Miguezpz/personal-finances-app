/**
 * Spec 014 (T028) · SavedMoveDialog: assigning writes a positive move, returning a negative one,
 * and an amount over the maximum shows it and writes nothing.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cents } from "@/domain/money";
import { queryKeys } from "@/data/query-keys";
import { SavedMoveDialog } from "@/features/goals/SavedMoveDialog";
import { emptySnapshot, makeGoal } from "../../utils/fixtures";
import { createMemoryProvider } from "../../utils/memory-provider";
import { renderWithProviders } from "../../utils/renderWithProviders";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const goal = makeGoal({ name: "Laptop" });

function open(mode: "assign" | "return", withGoal = true) {
  const snapshot = emptySnapshot({ goals: [goal] });
  const provider = createMemoryProvider(snapshot);
  const view = renderWithProviders(
    <SavedMoveDialog
      open
      onOpenChange={() => {}}
      mode={mode}
      goal={withGoal ? goal : null}
      goals={[goal]}
      max={cents(100_000)}
    />,
    { provider },
  );
  view.queryClient.setQueryData(queryKeys.snapshot, snapshot);
  const submit = (amount: string) => {
    fireEvent.change(screen.getByTestId("saved-move-amount"), { target: { value: amount } });
    fireEvent.click(screen.getByTestId("saved-move-save"));
  };
  return { provider, submit };
}

describe("SavedMoveDialog", () => {
  it("assigning from the Saved card picks the goal and writes a positive move", async () => {
    const { provider, submit } = open("assign", false);
    expect(screen.getByTestId("saved-move-goal")).toHaveValue(goal.id);
    submit("250");
    await waitFor(() =>
      expect(provider.goals.addSavedMove).toHaveBeenCalledWith(
        expect.objectContaining({ goalId: goal.id, amount: 25_000 }),
      ),
    );
  });

  it("returning writes a negative move", async () => {
    const { provider, submit } = open("return");
    expect(screen.queryByTestId("saved-move-goal")).toBeNull();
    submit("1,000");
    await waitFor(() =>
      expect(provider.goals.addSavedMove).toHaveBeenCalledWith(
        expect.objectContaining({ goalId: goal.id, amount: -100_000 }),
      ),
    );
  });

  it("over the maximum shows it and writes nothing", async () => {
    const { provider, submit } = open("assign");
    submit("1000.01");
    expect(await screen.findByText(/The most you can use is/)).toBeInTheDocument();
    expect(provider.goals.addSavedMove).not.toHaveBeenCalled();
  });
});
