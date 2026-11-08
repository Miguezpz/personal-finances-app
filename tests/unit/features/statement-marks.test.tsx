/**
 * Spec 011 (T016, T025) · "Ya la pagué" / "Desmarcar" hooks:
 *  - marking flips the snapshot at once and writes the mark; a failure restores it;
 *  - the read-only demo is refused before anything changes;
 *  - Undo removes exactly the mark that was written; unmarking and its Undo work the same way.
 */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import { ProviderError, type DataProvider, type StatementMarksRepository } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import type { FinanceSnapshot, StatementMark, Uuid } from "@/domain/types";
import { useStatementMarkActions } from "@/features/credit/use-statement-marks";
import { d, emptySnapshot, makeCard, makeMark } from "../../utils/fixtures";
import { createMemoryProvider } from "../../utils/memory-provider";
import { renderHookWithProviders } from "../../utils/renderWithProviders";

type ToastOptions = { duration?: number; action?: { label: string; onClick: () => void } };
const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn<(message: string, options?: ToastOptions) => string>(() => "toast-id"),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock("sonner", () => ({ toast: toastMock }));
const demoNotice = vi.hoisted(() => vi.fn());
vi.mock("@/lib/demo-notice", () => ({ notifyDemoReadOnly: demoNotice, notifyOffline: vi.fn() }));

const card = makeCard({ name: "Nu" });
const cutOff = d("2026-11-10");

function writableProvider(initial: FinanceSnapshot) {
  const base = createMemoryProvider(initial);
  const marks: StatementMark[] = [...initial.statementMarks];
  let seq = 0;
  const statementMarks = {
    list: vi.fn(async () => marks),
    create: vi.fn<StatementMarksRepository["create"]>(async (input) => {
      const row = {
        id: `00000000-0000-4000-b000-${(++seq).toString().padStart(12, "0")}` as Uuid,
        ...input,
      };
      marks.push(row);
      return row;
    }),
    remove: vi.fn<StatementMarksRepository["remove"]>(async (id) => {
      marks.splice(marks.findIndex((m) => m.id === id) >>> 0, 1);
    }),
  };
  return { ...base, statementMarks } satisfies DataProvider;
}

function setup(initial: FinanceSnapshot, provider: DataProvider) {
  const view = renderHookWithProviders(() => useStatementMarkActions(), { provider });
  view.queryClient.setQueryData(queryKeys.snapshot, initial);
  const cached = () => view.queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot);
  return { ...view, cached };
}

const undoOf = (call = 0) => {
  const action = toastMock.success.mock.calls[call]?.[1]?.action;
  if (!action) throw new Error("no Undo on the toast");
  return action.onClick;
};

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.dismiss.mockClear();
  demoNotice.mockClear();
});

describe("useStatementMarkActions", () => {
  it("marks at once, writes the mark and offers Undo", async () => {
    const initial = emptySnapshot({ accounts: [card] });
    const provider = writableProvider(initial);
    const { result, cached } = setup(initial, provider);

    act(() => result.current.mark(card, cutOff));

    await waitFor(() => expect(cached()?.statementMarks).toHaveLength(1));
    expect(cached()?.statementMarks[0]).toMatchObject({ cardAccountId: card.id, cutOff });
    await waitFor(() =>
      expect(provider.statementMarks.create).toHaveBeenCalledWith({
        cardAccountId: card.id,
        cutOff,
      }),
    );
    expect(toastMock.success).toHaveBeenCalledWith(
      "Nu marked as paid.",
      expect.objectContaining({ duration: 6000 }),
    );
  });

  it("restores the snapshot when the write fails", async () => {
    const initial = emptySnapshot({ accounts: [card] });
    const provider = writableProvider(initial);
    provider.statementMarks.create.mockRejectedValueOnce(new ProviderError("UNKNOWN", "boom"));
    const { result, cached } = setup(initial, provider);

    act(() => result.current.mark(card, cutOff));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(cached()?.statementMarks).toEqual([]);
    expect(toastMock.dismiss).toHaveBeenCalledWith("toast-id");
  });

  it("Undo removes exactly the mark that was written", async () => {
    const initial = emptySnapshot({ accounts: [card] });
    const provider = writableProvider(initial);
    const { result, cached } = setup(initial, provider);

    act(() => result.current.mark(card, cutOff));
    await waitFor(() => expect(provider.statementMarks.create).toHaveBeenCalled());
    const written = await provider.statementMarks.create.mock.results[0]?.value;
    act(() => undoOf()());

    await waitFor(() => expect(provider.statementMarks.remove).toHaveBeenCalledWith(written.id));
    await waitFor(() => expect(cached()?.statementMarks).toEqual([]));
  });

  it("unmarks at once and its Undo marks the same cut-off again", async () => {
    const own = makeMark({ cardAccountId: card.id, cutOff });
    const initial = emptySnapshot({ accounts: [card], statementMarks: [own] });
    const provider = writableProvider(initial);
    const { result, cached } = setup(initial, provider);

    act(() => result.current.unmark(card, own));

    await waitFor(() => expect(cached()?.statementMarks).toEqual([]));
    await waitFor(() => expect(provider.statementMarks.remove).toHaveBeenCalledWith(own.id));
    expect(toastMock.success).toHaveBeenCalledWith("Nu unmarked.", expect.anything());
    act(() => undoOf()());
    await waitFor(() =>
      expect(provider.statementMarks.create).toHaveBeenCalledWith({
        cardAccountId: card.id,
        cutOff,
      }),
    );
  });

  it("the read-only demo is refused before anything changes", () => {
    const initial = emptySnapshot({ accounts: [card] });
    const provider = createMockProvider({ snapshot: initial });
    const create = vi.spyOn(provider.statementMarks, "create");
    const { result, cached } = setup(initial, provider);

    act(() => result.current.mark(card, cutOff));

    expect(demoNotice).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(cached()?.statementMarks).toEqual([]);
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
