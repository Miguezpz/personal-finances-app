"use client";

/**
 * Side effects of the preferences (T047), kept OUT of the store (contracts/ui-store.ts):
 *   <html lang>            ← locale
 *   <html data-privacy>    ← 'on' | 'off'  (CSS blurs .money when on)
 *   cookie NEXT_LOCALE     ← locale (first-visit fallback for the inline pre-paint script)
 * Plus connectivity → ui.offline.
 */
import { useEffect } from "react";
import { useUi } from "./ui";
import {
  hydratePreferences,
  LOCALE_COOKIE,
  usePreferences,
  type PersistedPreferences,
} from "./preferences";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function applyPreferences(prefs: Pick<PersistedPreferences, "locale" | "privacyMode">) {
  const root = document.documentElement;
  root.lang = prefs.locale;
  root.dataset.privacy = prefs.privacyMode ? "on" : "off";
  document.cookie = `${LOCALE_COOKIE}=${prefs.locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
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
 * applies the stored locale and privacy mode to <html> so a reload never flashes amounts or
 * the wrong language. Falls back to the NEXT_LOCALE cookie, then to EN.
 */
export const PREFERENCES_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,l="en",p=false;try{var s=JSON.parse(localStorage.getItem("pfa:prefs:v1")||"null");if(s&&s.state){if(s.state.locale==="en"||s.state.locale==="es")l=s.state.locale;p=s.state.privacyMode===true;}else{var m=/(?:^|;\\s*)NEXT_LOCALE=(en|es)/.exec(document.cookie);if(m)l=m[1];}}catch(e){}d.lang=l;d.dataset.privacy=p?"on":"off";}catch(e){}})();`;
