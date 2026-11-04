"use client";

/**
 * Side effects of the preferences (T047), kept OUT of the store (contracts/ui-store.ts):
 *   <html lang>            ← locale
 *   <html data-privacy>    ← 'on' | 'off'  (CSS blurs .money when on)
 *   cookie NEXT_LOCALE     ← locale (first-visit fallback for the inline pre-paint script)
 *   <html class="dark">, color-scheme, <meta name="theme-color"> ← theme (spec 003, contracts/ui-theme.md §4)
 * Plus connectivity → ui.offline.
 */
import { useEffect } from "react";
import { useUi } from "./ui";
import {
  hydratePreferences,
  LOCALE_COOKIE,
  resolveTheme,
  usePreferences,
  type PersistedPreferences,
  type ResolvedTheme,
} from "./preferences";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function applyPreferences(prefs: Pick<PersistedPreferences, "locale" | "privacyMode">) {
  const root = document.documentElement;
  root.lang = prefs.locale;
  root.dataset.privacy = prefs.privacyMode ? "on" : "off";
  document.cookie = `${LOCALE_COOKIE}=${prefs.locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** Browser UI color of each theme (same values as `viewport.themeColor` in src/app/layout.tsx). */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#FFFFFF", dark: "#031F1D" };
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Applies a resolved theme to <html>. `explicit` (the user picked light/dark): both theme-color metas take that
 * theme's color; otherwise ("system") each meta gets back its original, media-dependent content (FR-011).
 */
export function applyTheme(resolved: ResolvedTheme, explicit: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (meta.dataset.originalContent === undefined) meta.dataset.originalContent = meta.content;
    meta.content = explicit ? THEME_COLORS[resolved] : meta.dataset.originalContent;
  }
}

const prefersDark = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;

function applyStoredTheme() {
  const { theme } = usePreferences.getState();
  applyTheme(resolveTheme(theme, prefersDark()), theme !== "system");
}

export function PreferencesEffects() {
  useEffect(() => {
    void hydratePreferences().then(() => applyPreferences(usePreferences.getState()));
    return usePreferences.subscribe((state, prev) => {
      if (!state.hydrated) return;
      if (
        state.locale !== prev.locale ||
        state.privacyMode !== prev.privacyMode ||
        !prev.hydrated
      ) {
        applyPreferences(state);
      }
    });
  }, []);

  // Theme: applied after hydration and on every change; with "system", follows the OS live (FR-017).
  useEffect(() => {
    let mql: MediaQueryList | null = null;
    const followSystem = (follow: boolean) => {
      if (follow && !mql && window.matchMedia) {
        mql = window.matchMedia(DARK_QUERY);
        mql.addEventListener("change", applyStoredTheme);
      } else if (!follow && mql) {
        mql.removeEventListener("change", applyStoredTheme);
        mql = null;
      }
    };
    const sync = () => {
      const { hydrated, theme } = usePreferences.getState();
      if (!hydrated) return;
      followSystem(theme === "system");
      applyStoredTheme();
    };
    sync();
    const unsubscribe = usePreferences.subscribe((state, prev) => {
      if (state.theme !== prev.theme || state.hydrated !== prev.hydrated) sync();
    });
    return () => {
      unsubscribe();
      followSystem(false);
    };
  }, []);

  useEffect(() => {
    const setOffline = useUi.getState().setOffline;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return null;
}

/**
 * Inline <head> script (runs before first paint, see Next "Preventing flash before hydration"):
 * applies the stored locale, privacy mode and theme to <html> so a reload never flashes amounts, the wrong
 * language or the wrong theme (SC-004). Falls back to the NEXT_LOCALE cookie, then to EN; an unknown theme or no
 * matchMedia → "system" / light.
 */
export const PREFERENCES_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,l="en",p=false,t="system";try{var s=JSON.parse(localStorage.getItem("pfa:prefs:v1")||"null");if(s&&s.state){if(s.state.locale==="en"||s.state.locale==="es")l=s.state.locale;p=s.state.privacyMode===true;if(s.state.theme==="light"||s.state.theme==="dark")t=s.state.theme;}else{var m=/(?:^|;\\s*)NEXT_LOCALE=(en|es)/.exec(document.cookie);if(m)l=m[1];}}catch(e){}var k=t==="dark"||(t==="system"&&!!window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);d.classList.toggle("dark",k);d.style.colorScheme=k?"dark":"light";d.lang=l;d.dataset.privacy=p?"on":"off";document.title=l==="es"?"Finanzas Personales":"Personal Finances";}catch(e){}})();`;
