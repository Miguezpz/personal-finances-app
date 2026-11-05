/**
 * Spec 004 (T015, T020): the default taxonomy is the owner's (26 categories, 68 subcategories),
 * is translatable, uses curated icons, and stays identical to the backfill list of migration 0008.
 */
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_TAXONOMY } from "@/domain/default-taxonomy";
import { isCategoryIconKey } from "@/domain/icons";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

const lookup = (messages: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      messages,
    );

describe("DEFAULT_TAXONOMY", () => {
  it("has the 26 categories of the owner, 13 Needs and 13 Wants", () => {
    expect(DEFAULT_TAXONOMY).toHaveLength(26);
    expect(DEFAULT_TAXONOMY.filter((c) => c.macro === "needs")).toHaveLength(13);
    expect(DEFAULT_TAXONOMY.filter((c) => c.macro === "wants")).toHaveLength(13);
  });

  it("has 68 subcategories", () => {
    expect(DEFAULT_TAXONOMY.flatMap((c) => c.subcategories)).toHaveLength(68);
  });

  it("has unique category names and unique subcategory names within each category", () => {
    const names = DEFAULT_TAXONOMY.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of DEFAULT_TAXONOMY) {
      const subs = c.subcategories.map((s) => s.name);
      expect(new Set(subs).size, c.name).toBe(subs.length);
      expect(subs.length, c.name).toBeGreaterThan(0);
    }
    const keys = DEFAULT_TAXONOMY.map((c) => c.nameKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses curated icons and leaves subcategories without a translation key", () => {
    for (const c of DEFAULT_TAXONOMY) {
      expect(isCategoryIconKey(c.icon), `${c.name} → ${c.icon}`).toBe(true);
      for (const s of c.subcategories) expect(s).not.toHaveProperty("nameKey");
    }
  });

  it("translates every category in English and Spanish", () => {
    for (const c of DEFAULT_TAXONOMY) {
      expect(typeof lookup(en, c.nameKey), `en ${c.nameKey}`).toBe("string");
      expect(typeof lookup(es, c.nameKey), `es ${c.nameKey}`).toBe("string");
    }
  });

  it("includes Previous Balances in Needs with its single subcategory (FR-004)", () => {
    const previous = DEFAULT_TAXONOMY.find((c) => c.name === "Previous Balances");
    expect(previous).toMatchObject({
      macro: "needs",
      nameKey: "taxonomy.categories.previousBalances",
      subcategories: [{ name: "Previous balances" }],
    });
  });

  it("matches the (name, name_key, icon) list of the 0008 backfill exactly", () => {
    const sql = readFileSync(
      resolvePath(process.cwd(), "supabase/migrations/0008_taxonomy_income_icons.sql"),
      "utf8",
    );
    const block = /-- taxonomy-004:start([\s\S]*?)-- taxonomy-004:end/.exec(sql)?.[1] ?? "";
    const rows = [...block.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g)].map(
      ([, name, nameKey, icon]) => ({ name, nameKey, icon }),
    );
    expect(rows).toEqual(
      DEFAULT_TAXONOMY.map(({ name, nameKey, icon }) => ({ name, nameKey, icon })),
    );
  });
});
