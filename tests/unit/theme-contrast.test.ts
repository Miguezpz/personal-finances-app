/**
 * Spec 003 · FR-003 / FR-004 / FR-039 / SC-001: every text/background pair and every non-text indicator of the
 * palette meets WCAG 2.1 AA in BOTH themes. Reads the single source of truth (src/styles/tokens.css), so retouching a
 * color can't silently break contrast. Pairs: specs/_archive/003-ui-refresh/contracts/ui-theme.md §1 "Pares verificados".
 */
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs from the repo root (import.meta.url isn't a file: URL under jsdom).
const CSS = readFileSync(resolvePath(process.cwd(), "src/styles/tokens.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Custom properties declared directly in the block opened by `selector {`. */
function declarations(selector: string): Map<string, string> {
  const match = new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!match?.[1]) throw new Error(`Block ${selector} not found in tokens.css`);
  const out = new Map<string, string>();
  for (const [, name, value] of match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name as string, (value as string).trim());
  }
  return out;
}

const ROOT = declarations(":root");
const DARK = declarations(".dark");
const THEMES = {
  light: ROOT,
  // .dark only overrides the semantics; the primitives come from :root.
  dark: new Map([...ROOT, ...DARK]),
} as const;

/** Resolves a semantic token to HEX: either a HEX literal or one level of var(--brand-*). */
function resolve(theme: Map<string, string>, token: string): string {
  const value = theme.get(`--${token}`);
  if (!value) throw new Error(`--${token} is not defined`);
  const ref = /^var\((--brand-[\w-]+)\)$/.exec(value);
  const hex = ref ? theme.get(ref[1] as string) : value;
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`--${token} must be a HEX or var(--brand-*) (got "${value}")`);
  }
  return hex.toLowerCase();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "muted"],
  ["card-foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "card"],
  ["muted-foreground", "surface-highlight"],
  ["primary-foreground", "primary"],
  ["cta-foreground", "cta"],
  ["success", "surface-highlight"],
  ["success", "background"],
  ["destructive", "background"],
  ["nav-active-foreground", "nav-active"],
  ["primary", "background"],
];

const NON_TEXT_PAIRS: [string, string][] = [
  ["ring", "background"],
  ["ring", "card"],
  ["input", "background"],
  ["input", "card"],
  ["series-1", "background"],
  ["series-2", "background"],
  ["series-3", "background"],
  ["series-1", "surface-highlight"],
  ["series-2", "surface-highlight"],
  ["series-3", "surface-highlight"],
  ["primary", "muted"],
];

describe("contrast helper", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});

describe.each(Object.entries(THEMES))("tokens.css · %s theme", (_name, theme) => {
  it.each(TEXT_PAIRS)("text %s on %s is ≥ 4.5:1", (fg, bg) => {
    expect(contrast(resolve(theme, fg), resolve(theme, bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)("indicator %s on %s is ≥ 3:1", (fg, bg) => {
    expect(contrast(resolve(theme, fg), resolve(theme, bg))).toBeGreaterThanOrEqual(3);
  });
});

describe("FR-004 · emerald is never a text color on light surfaces", () => {
  it.each(["foreground", "muted-foreground", "primary", "success", "card-foreground"])(
    "light --%s is not --brand-emerald",
    (token) => {
      expect(ROOT.get(`--${token}`)).not.toBe("var(--brand-emerald)");
      expect(resolve(ROOT, token)).not.toBe(resolve(ROOT, "brand-emerald"));
    },
  );
});
