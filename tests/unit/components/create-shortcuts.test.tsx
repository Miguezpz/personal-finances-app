/** Spec 008 · FR-011: N / I / P open the create dialogs, but never steal a letter from a form. */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCreateShortcuts } from "@/components/layout/use-create-shortcuts";
import { useUi } from "@/store/ui";

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
  );

const reset = () =>
  useUi.setState({
    activeDialog: null,
    createSheetOpen: false,
    sidebarOpen: false,
    preferencesOpen: false,
  });

describe("useCreateShortcuts", () => {
  beforeEach(reset);
  afterEach(() => {
    reset();
    document.body.innerHTML = "";
  });

  it.each([
    ["n", "expense"],
    ["i", "income"],
    ["p", "card-payment"],
    ["N", "expense"],
  ])("%s opens the %s dialog", (key, kind) => {
    renderHook(() => useCreateShortcuts(true));
    press(key);
    expect(useUi.getState().activeDialog).toEqual({ kind });
  });

  it("ignores keys typed in a field", () => {
    renderHook(() => useCreateShortcuts(true));
    const input = document.createElement("input");
    document.body.append(input);
    press("n", {}, input);
    expect(useUi.getState().activeDialog).toBeNull();
  });

  it("ignores modifier combinations", () => {
    renderHook(() => useCreateShortcuts(true));
    press("n", { ctrlKey: true });
    press("p", { metaKey: true });
    press("i", { altKey: true });
    expect(useUi.getState().activeDialog).toBeNull();
  });

  it("does nothing while a dialog or panel is open", () => {
    renderHook(() => useCreateShortcuts(true));
    useUi.setState({ createSheetOpen: true });
    press("n");
    expect(useUi.getState().activeDialog).toBeNull();
    useUi.setState({ createSheetOpen: false, activeDialog: { kind: "income" } });
    press("n");
    expect(useUi.getState().activeDialog).toEqual({ kind: "income" });
  });

  it("ignores P without active credit cards", () => {
    renderHook(() => useCreateShortcuts(false));
    press("p");
    expect(useUi.getState().activeDialog).toBeNull();
  });
});
