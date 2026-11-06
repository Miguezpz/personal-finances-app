/**
 * Bank / issuer catalog: an account's logo comes from its free-text `institution` (falling back to
 * its name), matched against each entry's aliases. No DB field and no third-party logo service
 * (Principle V): the logos are static tiles in `public/logos/<slug>.svg`. An entry without a logo
 * file renders as a monogram on its brand color. Pure.
 */
import type { Account } from "./types";

export interface Institution {
  slug: string;
  /** Display name, also offered as a suggestion in the account form. */
  name: string;
  /** Normalized (see `normalize`) words that identify it; matched as whole words. */
  aliases: readonly string[];
  /** Brand color (the tile background; used by the monogram). */
  color: string;
  /** Whether `public/logos/<slug>.svg` exists. */
  logo: boolean;
}

export const INSTITUTIONS: readonly Institution[] = [
  {
    slug: "american-express",
    name: "American Express",
    aliases: ["american express", "amex"],
    color: "#2E77BC",
    logo: true,
  },
  {
    slug: "banamex",
    name: "Banamex",
    aliases: ["banamex", "citibanamex"],
    color: "#E1091D",
    logo: true,
  },
  { slug: "banorte", name: "Banorte", aliases: ["banorte"], color: "#EB0029", logo: true },
  { slug: "banregio", name: "Banregio", aliases: ["banregio"], color: "#FF6B00", logo: true },
  { slug: "bbva", name: "BBVA", aliases: ["bbva", "bancomer"], color: "#001391", logo: true },
  { slug: "didi", name: "DiDi", aliases: ["didi"], color: "#FF6400", logo: true },
  { slug: "finsus", name: "Finsus", aliases: ["finsus"], color: "#23223F", logo: true },
  { slug: "gbm", name: "GBM", aliases: ["gbm"], color: "#000000", logo: true },
  { slug: "hey-banco", name: "Hey Banco", aliases: ["hey banco"], color: "#000000", logo: false },
  { slug: "hsbc", name: "HSBC", aliases: ["hsbc"], color: "#DB0011", logo: true },
  { slug: "klar", name: "Klar", aliases: ["klar"], color: "#111111", logo: false },
  {
    slug: "mercado-pago",
    name: "Mercado Pago",
    aliases: ["mercado pago", "mercadopago"],
    color: "#00B1EA",
    logo: true,
  },
  { slug: "nu", name: "Nu", aliases: ["nu", "nubank"], color: "#820AD1", logo: true },
  { slug: "openbank", name: "Openbank", aliases: ["openbank"], color: "#E30613", logo: false },
  { slug: "plata", name: "Plata", aliases: ["plata"], color: "#FF4F12", logo: true },
  { slug: "santander", name: "Santander", aliases: ["santander"], color: "#EC0000", logo: true },
  {
    slug: "scotiabank",
    name: "Scotiabank",
    aliases: ["scotiabank", "scotia"],
    color: "#EC111A",
    logo: true,
  },
  { slug: "stori", name: "Stori", aliases: ["stori"], color: "#003A40", logo: true },
];

/** Lowercase, no accents, words separated by single spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function match(text: string | null): Institution | null {
  if (!text) return null;
  const words = ` ${normalize(text)} `;
  return INSTITUTIONS.find((i) => i.aliases.some((a) => words.includes(` ${a} `))) ?? null;
}

/** The institution of an account: by its `institution` first, then by its name; null = unknown. */
export function institutionOf(account: Pick<Account, "institution" | "name">): Institution | null {
  return match(account.institution) ?? match(account.name);
}

/** Up to two initials for the monogram ("Hey Banco" → "HB", "Klar" → "K"). */
export function monogramOf(institution: Institution): string {
  return institution.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
