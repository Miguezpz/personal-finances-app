/**
 * Default spending taxonomy created on first run (onboarding, T054) and used by the demo data.
 * `nameKey` is the i18n key (messages `taxonomy.*`); `name` is the stored fallback (EN).
 * User-created categories have nameKey = null and are shown exactly as typed (US7-5).
 */
import type { SpendBucket } from "./types";

export interface DefaultSubcategory {
  readonly nameKey: string;
  readonly name: string;
}

export interface DefaultCategory {
  readonly nameKey: string;
  readonly name: string;
  readonly macro: SpendBucket;
  readonly subcategories: readonly DefaultSubcategory[];
}

export const DEFAULT_TAXONOMY: readonly DefaultCategory[] = [
  {
    nameKey: "taxonomy.housing",
    name: "Housing",
    macro: "needs",
    subcategories: [
      { nameKey: "taxonomy.rent", name: "Rent" },
      { nameKey: "taxonomy.utilities", name: "Utilities" },
      { nameKey: "taxonomy.internetPhone", name: "Internet & phone" },
    ],
  },
  {
    nameKey: "taxonomy.food",
    name: "Food",
    macro: "needs",
    subcategories: [
      { nameKey: "taxonomy.groceries", name: "Groceries" },
      { nameKey: "taxonomy.market", name: "Local market" },
    ],
  },
  {
    nameKey: "taxonomy.transport",
    name: "Transport",
    macro: "needs",
    subcategories: [
      { nameKey: "taxonomy.fuel", name: "Fuel" },
      { nameKey: "taxonomy.publicTransport", name: "Public transport" },
    ],
  },
  {
    nameKey: "taxonomy.health",
    name: "Health",
    macro: "needs",
    subcategories: [
      { nameKey: "taxonomy.pharmacy", name: "Pharmacy" },
      { nameKey: "taxonomy.doctor", name: "Doctor" },
    ],
  },
  {
    nameKey: "taxonomy.diningOut",
    name: "Dining out",
    macro: "wants",
    subcategories: [
      { nameKey: "taxonomy.restaurants", name: "Restaurants" },
      { nameKey: "taxonomy.coffee", name: "Coffee & snacks" },
    ],
  },
  {
    nameKey: "taxonomy.entertainment",
    name: "Entertainment",
    macro: "wants",
    subcategories: [
      { nameKey: "taxonomy.streaming", name: "Streaming" },
      { nameKey: "taxonomy.events", name: "Events" },
    ],
  },
  {
    nameKey: "taxonomy.shopping",
    name: "Shopping",
    macro: "wants",
    subcategories: [
      { nameKey: "taxonomy.clothing", name: "Clothing" },
      { nameKey: "taxonomy.electronics", name: "Electronics" },
    ],
  },
  {
    nameKey: "taxonomy.fitness",
    name: "Fitness",
    macro: "wants",
    subcategories: [{ nameKey: "taxonomy.gym", name: "Gym" }],
  },
];
