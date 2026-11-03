/**
 * T113 · EN/ES dictionaries are complete mirrors (FR-039, SC-010): exactly the same keys, no empty
 * strings, and the same interpolation arguments (an `{amount}` missing in one language would render
 * a broken sentence there).
 */
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** ICU argument names: `{name}`, `{count, plural, …}` → name, count. `#` inside plurals isn't an argument. */
export function argumentsOf(message: string): string[] {
  return [...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)].map((m) => m[1] as string).sort();
}

const EN = flatten(en as Tree);
const ES = flatten(es as Tree);

describe("i18n dictionaries", () => {
  it("have exactly the same keys", () => {
    const onlyEn = [...EN.keys()].filter((k) => !ES.has(k));
    const onlyEs = [...ES.keys()].filter((k) => !EN.has(k));
    expect({ onlyEn, onlyEs }).toEqual({ onlyEn: [], onlyEs: [] });
  });

  it("have no empty strings", () => {
    const empty = [...EN, ...ES].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("use the same interpolation arguments in both languages", () => {
    const mismatched = [...EN.keys()]
      .filter((k) => ES.has(k))
      .filter(
        (k) => argumentsOf(EN.get(k) as string).join() !== argumentsOf(ES.get(k) as string).join(),
      );
    expect(mismatched).toEqual([]);
  });

  it("parses arguments correctly (self-check)", () => {
    expect(argumentsOf("{days, plural, one {# day} other {# days}} to {date}")).toEqual([
      "date",
      "days",
    ]);
    expect(argumentsOf("Total: {total}")).toEqual(["total"]);
    expect(argumentsOf("No arguments")).toEqual([]);
  });
});
