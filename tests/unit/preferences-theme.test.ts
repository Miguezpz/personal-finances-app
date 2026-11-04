/**
 * Spec 003 · US3 theme preference (data-model.md §1, contracts/ui-theme.md §4): validation on rehydration, the
 * resolved theme, the DOM effects of applyTheme and the pre-paint boot script (FR-015…017, SC-004).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, PREFERENCES_BOOT_SCRIPT } from "@/store/effects";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  resolveTheme,
  usePreferences,
} from "@/store/preferences";

function store(state: Record<string, unknown> | null) {
  if (state === null) localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  else localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ state, version: 1 }));
}

function stubPrefersDark(matches: boolean | null) {
  vi.stubGlobal(
    "matchMedia",
    matches === null
      ? undefined
      : (query: string) => ({
          matches: query === "(prefers-color-scheme: dark)" && matches,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
  );
}

const root = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  usePreferences.setState({ ...DEFAULT_PREFERENCES, hydrated: false });
  root().className = "";
  root().removeAttribute("style");
  document.head.innerHTML = "";
});

afterEach(() => {
  localStorage.clear();
});

describe("theme preference in the store", () => {
  it("defaults to system", () => {
    expect(DEFAULT_PREFERENCES.theme).toBe("system");
  });

  it.each(["system", "light", "dark"] as const)("rehydrates a stored %s", async (theme) => {
    store({ locale: "en", theme });
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().theme).toBe(theme);
  });

  it.each(["neon", 42, null, ""])("ignores an invalid stored theme (%s)", async (theme) => {
    store({ locale: "es", theme });
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().theme).toBe("system");
    // The rest of the stored preferences still apply.
    expect(usePreferences.getState().locale).toBe("es");
  });

  it("a state saved before the theme existed rehydrates with system", async () => {
    store({ locale: "es", displayCurrency: "USD", privacyMode: true });
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState()).toMatchObject({
      theme: "system",
      locale: "es",
      displayCurrency: "USD",
      privacyMode: true,
    });
  });

  it("setTheme persists the choice", () => {
    usePreferences.getState().setTheme("dark");
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}");
    expect(saved.state.theme).toBe("dark");
  });
});

describe("resolveTheme", () => {
  it("follows the OS only in system mode", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("applyTheme", () => {
  function addThemeColorMetas() {
    document.head.innerHTML = `
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FFFFFF">
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#031F1D">`;
    return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  }

  it("dark + explicit: .dark, color-scheme and both metas in the dark color", () => {
    const metas = addThemeColorMetas();
    applyTheme("dark", true);
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().style.colorScheme).toBe("dark");
    expect(metas.map((m) => m.content)).toEqual(["#031F1D", "#031F1D"]);
  });

  it("light + explicit: no .dark and both metas in the light color", () => {
    const metas = addThemeColorMetas();
    applyTheme("dark", true);
    applyTheme("light", true);
    expect(root().classList.contains("dark")).toBe(false);
    expect(root().style.colorScheme).toBe("light");
    expect(metas.map((m) => m.content)).toEqual(["#FFFFFF", "#FFFFFF"]);
  });

  it("system: restores the original, media-dependent contents", () => {
    const metas = addThemeColorMetas();
    applyTheme("dark", true);
    applyTheme("light", false);
    expect(metas.map((m) => m.content)).toEqual(["#FFFFFF", "#031F1D"]);
  });
});

describe("PREFERENCES_BOOT_SCRIPT (before the first paint)", () => {
  const run = () => new Function(PREFERENCES_BOOT_SCRIPT)();

  it.each([
    { stored: null, prefersDark: true, dark: true },
    { stored: null, prefersDark: false, dark: false },
    { stored: { theme: "system" }, prefersDark: true, dark: true },
    { stored: { theme: "light" }, prefersDark: true, dark: false },
    { stored: { theme: "dark" }, prefersDark: false, dark: true },
    { stored: { theme: "neon" }, prefersDark: true, dark: true },
    { stored: { theme: "neon" }, prefersDark: false, dark: false },
    { stored: { theme: "system" }, prefersDark: null, dark: false },
  ])("stored $stored, OS dark $prefersDark → dark $dark", ({ stored, prefersDark, dark }) => {
    store(stored);
    stubPrefersDark(prefersDark);
    run();
    expect(root().classList.contains("dark")).toBe(dark);
    expect(root().style.colorScheme).toBe(dark ? "dark" : "light");
  });

  it("still applies locale and privacy", () => {
    store({ locale: "es", privacyMode: true, theme: "dark" });
    stubPrefersDark(false);
    run();
    expect(root().lang).toBe("es");
    expect(root().dataset.privacy).toBe("on");
  });

  it("never throws, even with unreadable storage", () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, "{not json");
    stubPrefersDark(true);
    expect(run).not.toThrow();
    expect(root().classList.contains("dark")).toBe(true);
  });
});
