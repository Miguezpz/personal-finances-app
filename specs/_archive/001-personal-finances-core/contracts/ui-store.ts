/**
 * Contrato: stores de Zustand (src/store/*).
 *
 * Reglas:
 *  - Zustand guarda SOLO estado de cliente: preferencias de dispositivo y estado efímero de UI.
 *  - Los datos de servidor y las tasas de cambio viven en TanStack Query, nunca aquí.
 *  - Los efectos secundarios (atributos del <html>, cookie de idioma) NO van dentro del store:
 *    los aplica <PreferencesEffects /> (src/store/effects.tsx) suscrito a los cambios.
 *  - Persistencia: localStorage, clave versionada `pfa:prefs:v1`, con try/catch (puede fallar o estar vacío).
 */
import type { Cents, DisplayCurrency, Locale } from './domain-types';

// ---------------------------------------------------------------------------
// Preferencias (persistidas)
// ---------------------------------------------------------------------------
export interface PreferencesState {
  /** Idioma de la interfaz. Por defecto 'en' (Principio VI). */
  locale: Locale;
  /** Divisa de visualización. Solo presentación; los datos siguen en MXN. */
  displayCurrency: DisplayCurrency;
  /** Modo Privacidad: enmascara importes, saldos y ejes de gráficas. */
  privacyMode: boolean;
  /**
   * Tema (añadido en spec 003, ver specs/003-ui-refresh/data-model.md §1). Por defecto 'system';
   * un valor guardado inválido se ignora en `merge`. Sin cambio de versión de la clave.
   */
  theme: ThemePreference;
  /**
   * false hasta que se rehidrata desde localStorage. Mientras sea false y no sea demo, <Money> debe
   * mostrarse enmascarado (estado seguro por defecto: sin parpadeo de importes).
   */
  hydrated: boolean;
}

export interface PreferencesActions {
  setLocale(locale: Locale): void;
  setDisplayCurrency(currency: DisplayCurrency): void;
  togglePrivacy(): void;
  setPrivacy(on: boolean): void;
  /** Spec 003. */
  setTheme(theme: ThemePreference): void;
  /** Llamada una sola vez en el cliente (persist con skipHydration). */
  markHydrated(): void;
}

export type PreferencesStore = PreferencesState & PreferencesActions;

/** Parte persistida (partialize): excluye `hydrated` y las acciones. */
export type PersistedPreferences = Pick<
  PreferencesState,
  'locale' | 'displayCurrency' | 'privacyMode' | 'theme'
>;

/** Spec 003 (specs/003-ui-refresh/data-model.md §1). */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const PREFERENCES_STORAGE_KEY = 'pfa:prefs:v1' as const;

export const DEFAULT_PREFERENCES: PersistedPreferences = {
  locale: 'en',
  displayCurrency: 'MXN',
  privacyMode: false,
  theme: 'system',
};

/**
 * Selectores atómicos (evitan re-renders): usar siempre selectores, nunca el store completo.
 *   const locale = usePreferences(selectLocale);
 */
export const selectLocale = (s: PreferencesStore): Locale => s.locale;
export const selectDisplayCurrency = (s: PreferencesStore): DisplayCurrency => s.displayCurrency;
export const selectPrivacyMode = (s: PreferencesStore): boolean => s.privacyMode;
/** true si <Money> debe enmascarar: privacidad activa, o aún sin hidratar fuera de demo. */
export const selectShouldMask = (s: PreferencesStore, isDemo: boolean): boolean =>
  s.privacyMode || (!s.hydrated && !isDemo);

// ---------------------------------------------------------------------------
// UI efímera (no persistida)
// ---------------------------------------------------------------------------
export type DialogId =
  | 'register-income'
  | 'add-expense'
  | 'add-recurring'
  | 'add-receivable'
  | 'record-collection'
  | 'card-payment'
  | 'edit-rule'
  | 'confirm-delete';

export interface UiState {
  sidebarOpen: boolean;
  activeDialog: { id: DialogId; payload?: Readonly<Record<string, unknown>> } | null;
  /** true mientras una consulta supera el umbral de cold start (3 s). */
  waking: boolean;
  /** true si el navegador reporta navigator.onLine === false. */
  offline: boolean;
  /** Spec 003: la entrada escalonada del dashboard solo se reproduce una vez por sesión. */
  dashboardIntroPlayed: boolean;
  /** Spec 003: panel móvil de preferencias. Ver specs/003-ui-refresh/data-model.md §2. */
  preferencesOpen: boolean;
}

export interface UiActions {
  setSidebarOpen(open: boolean): void;
  openDialog(id: DialogId, payload?: Readonly<Record<string, unknown>>): void;
  closeDialog(): void;
  setWaking(waking: boolean): void;
  setOffline(offline: boolean): void;
  markDashboardIntroPlayed(): void;
  setPreferencesOpen(open: boolean): void;
}

export type UiStore = UiState & UiActions;

// ---------------------------------------------------------------------------
// Efectos derivados (aplicados por <PreferencesEffects />)
// ---------------------------------------------------------------------------
/**
 * - document.documentElement.lang           ← locale
 * - document.documentElement.dataset.privacy ← 'on' | 'off'  (CSS: html[data-privacy="on"] .money { filter: blur(...) })
 * - document.cookie NEXT_LOCALE              ← locale (para que el HTML inicial salga en el idioma elegido)
 * - <html class="dark">, color-scheme, meta theme-color ← theme (spec 003, contracts/ui-theme.md §4)
 */
export interface PreferencesEffectsContract {
  apply(state: PersistedPreferences): void;
}

// ---------------------------------------------------------------------------
// <Money> y formateo (src/components/money, src/i18n/format.ts)
// ---------------------------------------------------------------------------
/**
 * Único punto de render de importes. Props: { cents: Cents; currency?: DisplayCurrency; signed?: boolean }.
 *  - Convierte con `convert()` solo para presentación.
 *  - Si `selectShouldMask` es true: renderiza texto accesible "••••" y aplica la clase `.money` (blur).
 * Hook para gráficas: `useMoneyFormatter(): (cents: Cents) => string` devuelve "••••" cuando está enmascarado.
 */
export interface MoneyProps {
  cents: Cents;
  currency?: DisplayCurrency;
  signed?: boolean;
  className?: string;
}
