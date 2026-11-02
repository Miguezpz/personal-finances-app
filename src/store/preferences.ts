/**
 * Device preferences (T045, contracts/ui-store.ts): locale, display currency, privacy mode.
 * Client state only — server data and FX rates live in TanStack Query.
 *
 * Persistence: localStorage key `pfa:prefs:v1`, `skipHydration` + manual rehydration in
 * <PreferencesEffects /> (no SSR/client mismatch). Every storage access is guarded: it can throw
 * or be empty in private windows, previews or with blocked site data.
 */
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { DisplayCurrency, Locale } from "@/domain/types";

export interface PreferencesState {
  /** UI language. Default 'en' (Principle VI). */
  locale: Locale;
  /** Display currency. Presentation only; data stays in MXN. */
  displayCurrency: DisplayCurrency;
  /** Masks amounts, balances and chart axes. */
  privacyMode: boolean;
  /** false until rehydrated from storage; <Money> masks meanwhile outside the demo. */
  hydrated: boolean;
}

export interface PreferencesActions {
  setLocale(locale: Locale): void;
  setDisplayCurrency(currency: DisplayCurrency): void;
  togglePrivacy(): void;
  setPrivacy(on: boolean): void;
  markHydrated(): void;
}

export type PreferencesStore = PreferencesState & PreferencesActions;
export type PersistedPreferences = Pick<
  PreferencesState,
  "locale" | "displayCurrency" | "privacyMode"
>;

export const PREFERENCES_STORAGE_KEY = "pfa:prefs:v1" as const;
export const LOCALE_COOKIE = "NEXT_LOCALE" as const;

export const DEFAULT_PREFERENCES: PersistedPreferences = {
  locale: "en",
  displayCurrency: "MXN",
  privacyMode: false,
};

export const LOCALES: readonly Locale[] = ["en", "es"];
export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ["MXN", "USD", "EUR"];
export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);
const isCurrency = (v: unknown): v is DisplayCurrency =>
  DISPLAY_CURRENCIES.includes(v as DisplayCurrency);

/** localStorage that never throws (returns null / ignores writes when unavailable). */
export const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      /* storage full or blocked: preferences just won't persist */
    }
  },
  removeItem(name) {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const usePreferences = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      hydrated: false,
      setLocale: (locale) => set({ locale }),
      setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      togglePrivacy: () => set((s) => ({ privacyMode: !s.privacyMode })),
      setPrivacy: (privacyMode) => set({ privacyMode }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      skipHydration: true,
      partialize: (s): PersistedPreferences => ({
        locale: s.locale,
        displayCurrency: s.displayCurrency,
        privacyMode: s.privacyMode,
      }),
      // Never trust stored values blindly (tampering, older versions).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedPreferences>;
        return {
          ...current,
          ...(isLocale(p.locale) && { locale: p.locale }),
          ...(isCurrency(p.displayCurrency) && { displayCurrency: p.displayCurrency }),
          ...(typeof p.privacyMode === "boolean" && { privacyMode: p.privacyMode }),
        };
      },
    },
  ),
);

/** Locale stored in the NEXT_LOCALE cookie (first visit / e2e projects), if valid. */
export function readLocaleCookie(cookie: string): Locale | null {
  const match = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`).exec(cookie);
  const value = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isLocale(value) ? value : null;
}

/**
 * Rehydrates once on the client. With nothing stored yet, the NEXT_LOCALE cookie (if any)
 * decides the first locale; otherwise EN.
 */
export async function hydratePreferences(): Promise<void> {
  const state = usePreferences.getState();
  if (state.hydrated) return;
  const hadStored = safeLocalStorage.getItem(PREFERENCES_STORAGE_KEY) !== null;
  await usePreferences.persist.rehydrate();
  if (!hadStored && typeof document !== "undefined") {
    const fromCookie = readLocaleCookie(document.cookie);
    if (fromCookie) usePreferences.getState().setLocale(fromCookie);
  }
  usePreferences.getState().markHydrated();
}

// Atomic selectors (use these, never the whole store).
export const selectLocale = (s: PreferencesStore): Locale => s.locale;
export const selectDisplayCurrency = (s: PreferencesStore): DisplayCurrency => s.displayCurrency;
export const selectPrivacyMode = (s: PreferencesStore): boolean => s.privacyMode;
export const selectHydrated = (s: PreferencesStore): boolean => s.hydrated;
/**
 * true if <Money> must mask: privacy on, or not yet hydrated while the data is real.
 * `holdsRealData` = provider.capabilities.canWrite (the read-only demo serves fictitious data).
 */
export const selectShouldMask = (s: PreferencesStore, holdsRealData: boolean): boolean =>
  s.privacyMode || (!s.hydrated && holdsRealData);
