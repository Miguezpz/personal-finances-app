"use client";

/**
 * N / I open the expense and income dialogs (spec 008, FR-011, research.md R2; spec 011 removed P).
 * Ignored with modifiers, on key repeat, while typing in an editable element, or while any dialog
 * or panel is open — so they never steal a letter from a form.
 */
import { useEffect } from "react";
import { useUi } from "@/store/ui";
import { CREATE_ACTIONS } from "./create-actions";

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}

function anyPanelOpen(): boolean {
  const ui = useUi.getState();
  if (ui.activeDialog || ui.createSheetOpen || ui.sidebarOpen || ui.preferencesOpen) return true;
  return document.querySelector('[role="dialog"][data-state="open"], [role="menu"]') !== null;
}

export function useCreateShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
        return;
      if (isEditableTarget(e.target) || anyPanelOpen()) return;
      const action = CREATE_ACTIONS.find((a) => a.shortcut === e.key.toLowerCase());
      if (!action) return;
      e.preventDefault();
      useUi.getState().openCreate({ kind: action.kind });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
