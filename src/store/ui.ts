/** Ephemeral UI state (T045, contracts/ui-store.ts). Never persisted. */
import { create } from "zustand";

export type DialogId =
  | "register-income"
  | "add-expense"
  | "add-recurring"
  | "add-receivable"
  | "record-collection"
  | "card-payment"
  | "edit-rule"
  | "confirm-delete";

export interface UiState {
  sidebarOpen: boolean;
  activeDialog: { id: DialogId; payload?: Readonly<Record<string, unknown>> } | null;
  /** true while a query exceeds the cold-start threshold (3 s). */
  waking: boolean;
  /** true when the browser reports navigator.onLine === false. */
  offline: boolean;
}

export interface UiActions {
  setSidebarOpen(open: boolean): void;
  openDialog(id: DialogId, payload?: Readonly<Record<string, unknown>>): void;
  closeDialog(): void;
  setWaking(waking: boolean): void;
  setOffline(offline: boolean): void;
}

export type UiStore = UiState & UiActions;

export const useUi = create<UiStore>()((set) => ({
  sidebarOpen: false,
  activeDialog: null,
  waking: false,
  offline: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  openDialog: (id, payload) => set({ activeDialog: payload ? { id, payload } : { id } }),
  closeDialog: () => set({ activeDialog: null }),
  setWaking: (waking) => set({ waking }),
  setOffline: (offline) => set({ offline }),
}));
