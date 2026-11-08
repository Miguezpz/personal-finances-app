/** Ephemeral UI state (T045, contracts/ui-store.ts; spec 008 contracts/ui-shell.md). Never persisted. */
import { create } from "zustand";
import type { Cents, Expense, Income, Uuid } from "@/domain/types";

/**
 * The app-wide create/edit dialogs (spec 008, FR-009): each one is mounted once, by DialogHost, and
 * any screen opens it here — optionally with the entity to edit or the values to prefill.
 */
export type CreateDialog =
  | { kind: "expense"; expense?: Expense | null }
  | { kind: "income"; income?: Income | null }
  | { kind: "card-payment"; cardId?: Uuid | null; suggestedAmount?: Cents | null };

export type CreateDialogKind = CreateDialog["kind"];

export interface UiState {
  /** Mobile "More" panel (spec 008, FR-006). */
  sidebarOpen: boolean;
  /** Mobile "＋" create sheet (spec 008, FR-007). */
  createSheetOpen: boolean;
  activeDialog: CreateDialog | null;
  /** true while a query exceeds the cold-start threshold (3 s). */
  waking: boolean;
  /** true when the browser reports navigator.onLine === false. */
  offline: boolean;
  /** The dashboard's staggered entrance plays once per session (spec 003, FR-029). */
  dashboardIntroPlayed: boolean;
  /** Mobile appearance panel (spec 003, FR-021; renamed in spec 008, FR-016). */
  preferencesOpen: boolean;
}

export interface UiActions {
  setSidebarOpen(open: boolean): void;
  setCreateSheetOpen(open: boolean): void;
  /** Closes the create sheet, "More" and the appearance panel, then opens the dialog. */
  openCreate(dialog: CreateDialog): void;
  closeDialog(): void;
  setWaking(waking: boolean): void;
  setOffline(offline: boolean): void;
  markDashboardIntroPlayed(): void;
  setPreferencesOpen(open: boolean): void;
}

export type UiStore = UiState & UiActions;

export const useUi = create<UiStore>()((set) => ({
  sidebarOpen: false,
  createSheetOpen: false,
  activeDialog: null,
  waking: false,
  offline: false,
  dashboardIntroPlayed: false,
  preferencesOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setCreateSheetOpen: (createSheetOpen) => set({ createSheetOpen }),
  openCreate: (activeDialog) =>
    set({ activeDialog, createSheetOpen: false, sidebarOpen: false, preferencesOpen: false }),
  closeDialog: () => set({ activeDialog: null }),
  setWaking: (waking) => set({ waking }),
  setOffline: (offline) => set({ offline }),
  markDashboardIntroPlayed: () => set({ dashboardIntroPlayed: true }),
  setPreferencesOpen: (preferencesOpen) => set({ preferencesOpen }),
}));

/** Opens a create/edit dialog from anywhere (event handlers, shortcuts). */
export const openCreate = (dialog: CreateDialog) => useUi.getState().openCreate(dialog);
