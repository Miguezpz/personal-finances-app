/**
 * Bank logos: an account's institution (or, failing that, its name) maps to a catalog entry by
 * whole-word aliases; every entry that claims a logo ships its tile in public/logos.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTITUTIONS, institutionOf, monogramOf, normalize } from "@/domain/institutions";

const slugOf = (institution: string | null, name = "Cuenta") =>
  institutionOf({ institution, name })?.slug ?? null;

describe("institutionOf", () => {
  it("matches the institution text, ignoring case, accents and punctuation", () => {
    expect(slugOf("BBVA")).toBe("bbva");
    expect(slugOf("bbva méxico")).toBe("bbva");
    expect(slugOf("Mercado Pago")).toBe("mercado-pago");
    expect(slugOf("MercadoPago")).toBe("mercado-pago");
    expect(slugOf("Nu")).toBe("nu");
    expect(slugOf("Banregio")).toBe("banregio");
    expect(slugOf("Plata")).toBe("plata");
    expect(slugOf("Citibanamex")).toBe("banamex");
  });

  it("matches whole words only", () => {
    expect(slugOf("Nuevo Banco")).toBeNull();
    expect(slugOf("Menu")).toBeNull();
  });

  it("falls back to the account name when the institution is empty or unknown", () => {
    expect(slugOf(null, "Nu CC")).toBe("nu");
    expect(slugOf("Otro", "BBVA Blue CC")).toBe("bbva");
  });

  it("returns null for unknown banks (the demo's fictitious ones)", () => {
    expect(slugOf(null, "Efectivo")).toBeNull();
    expect(slugOf("Demo Bank", "Demo Credit")).toBeNull();
    expect(slugOf("Sample Credit", "Sample Card")).toBeNull();
  });
});

describe("catalog", () => {
  it("has unique slugs and normalized aliases", () => {
    const slugs = INSTITUTIONS.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const i of INSTITUTIONS) for (const a of i.aliases) expect(normalize(a)).toBe(a);
  });

  it("ships a tile for every entry with a logo", () => {
    for (const i of INSTITUTIONS.filter((x) => x.logo)) {
      expect(existsSync(join(process.cwd(), "public/logos", `${i.slug}.svg`)), i.slug).toBe(true);
    }
  });

  it("builds monograms of up to two initials", () => {
    const of = (slug: string) => monogramOf(INSTITUTIONS.find((i) => i.slug === slug)!);
    expect(of("hey-banco")).toBe("HB");
    expect(of("klar")).toBe("K");
  });
});
