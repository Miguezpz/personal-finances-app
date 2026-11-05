/**
 * Default spending taxonomy (spec 004): the owner's own taxonomy, created on first run (onboarding)
 * and used by the demo data. Source: the owner's cloud account on 2026-11-05 (research R1).
 *
 *  - `name` is the stored English name. It MUST match the owner's rows character by character: the
 *    backfill of migration 0008 (`private.apply_taxonomy_004`) pairs existing categories by name, and
 *    tests/unit/domain/default-taxonomy.test.ts checks that both lists stay identical.
 *  - `nameKey` is the i18n key of the CATEGORY (`taxonomy.housing` or `taxonomy.categories.*`).
 *  - Subcategories have no key (Clarification C): they are shown with their stored English name in
 *    both languages, like the ones the user creates.
 *  - `icon` is the category icon; subcategories inherit it (Clarification A).
 * User-created categories have nameKey = null and are shown exactly as typed (US7-5).
 */
import type { CategoryIconKey } from "./icons";
import type { SpendBucket } from "./types";

export interface DefaultSubcategory {
  readonly name: string;
}

export interface DefaultCategory {
  readonly nameKey: string;
  readonly name: string;
  readonly macro: SpendBucket;
  readonly icon: CategoryIconKey;
  readonly subcategories: readonly DefaultSubcategory[];
}

const subs = (...names: string[]): readonly DefaultSubcategory[] => names.map((name) => ({ name }));

export const DEFAULT_TAXONOMY: readonly DefaultCategory[] = [
  // ---------- Needs ----------
  {
    nameKey: "taxonomy.housing",
    name: "Housing",
    macro: "needs",
    icon: "house",
    // Utilities and Internet & phone live in Home Services and Telecom (research R1).
    subcategories: subs("Rent", "Maintenance", "Property tax"),
  },
  {
    nameKey: "taxonomy.categories.homeServices",
    name: "Home Services",
    macro: "needs",
    icon: "plug",
    subcategories: subs("Electricity", "Gas", "Internet", "Water"),
  },
  {
    nameKey: "taxonomy.categories.telecom",
    name: "Telecom",
    macro: "needs",
    icon: "smartphone",
    subcategories: subs("Mobile data", "Mobile plan"),
  },
  {
    nameKey: "taxonomy.categories.transportGas",
    name: "Transport & Gas",
    macro: "needs",
    icon: "car",
    subcategories: subs("Fuel", "Public transport", "Rideshare (Uber/DiDi)", "Tolls"),
  },
  {
    nameKey: "taxonomy.categories.groceries",
    name: "Groceries",
    macro: "needs",
    icon: "shopping-cart",
    subcategories: subs("Cleaning supplies", "Hygiene", "Pantry"),
  },
  {
    nameKey: "taxonomy.categories.healthInsurance",
    name: "Health & Insurance",
    macro: "needs",
    icon: "heart-pulse",
    subcategories: subs("Doctor", "Insurance", "Medicine"),
  },
  {
    nameKey: "taxonomy.categories.gymWellness",
    name: "Gym & Wellness",
    macro: "needs",
    icon: "dumbbell",
    subcategories: subs("Equipment", "Gym", "Supplements"),
  },
  {
    nameKey: "taxonomy.categories.fixedSubscriptions",
    name: "Fixed Subscriptions",
    macro: "needs",
    icon: "repeat",
    subcategories: subs("Cloud storage", "Software"),
  },
  {
    nameKey: "taxonomy.categories.maintenance",
    name: "Maintenance & Contingencies",
    macro: "needs",
    icon: "wrench",
    subcategories: subs("Car repairs", "Home repairs"),
  },
  {
    nameKey: "taxonomy.categories.education",
    name: "Education & Development",
    macro: "needs",
    icon: "graduation-cap",
    subcategories: subs("Books", "Certifications", "Courses"),
  },
  {
    nameKey: "taxonomy.categories.bankFees",
    name: "Bank Fees & Taxes",
    macro: "needs",
    icon: "landmark",
    subcategories: subs("Annual card fee", "Bank fees", "Taxes"),
  },
  {
    nameKey: "taxonomy.categories.pets",
    name: "Pets",
    macro: "needs",
    icon: "paw-print",
    subcategories: subs("Pet food", "Vet"),
  },
  {
    // Debt carried from previous months that is NOT a credit card: card debt is paid with a card
    // payment (which does not touch buckets), never recorded here, so it is not counted twice.
    nameKey: "taxonomy.categories.previousBalances",
    name: "Previous Balances",
    macro: "needs",
    icon: "clock-arrow-left",
    subcategories: subs("Previous balances"),
  },
  // ---------- Wants ----------
  {
    nameKey: "taxonomy.categories.restaurants",
    name: "Restaurants & Cafes",
    macro: "wants",
    icon: "utensils",
    subcategories: subs("Coffee", "Food delivery", "Restaurants"),
  },
  {
    nameKey: "taxonomy.categories.entertainment",
    name: "Entertainment & Leisure",
    macro: "wants",
    icon: "ticket",
    subcategories: subs("Bars", "Cinema", "Concerts", "Video games"),
  },
  {
    nameKey: "taxonomy.categories.streaming",
    name: "Streaming",
    macro: "wants",
    icon: "tv",
    subcategories: subs("Music streaming", "Video streaming"),
  },
  {
    nameKey: "taxonomy.categories.clothes",
    name: "Clothes & Shoes",
    macro: "wants",
    icon: "shirt",
    subcategories: subs("Accessories", "Clothing", "Shoes"),
  },
  {
    nameKey: "taxonomy.categories.personalCare",
    name: "Personal Care",
    macro: "wants",
    icon: "scissors",
    subcategories: subs("Barbershop", "Fragrance", "Skincare"),
  },
  {
    nameKey: "taxonomy.categories.gifts",
    name: "Gifts & Commitments",
    macro: "wants",
    icon: "gift",
    subcategories: subs("Anniversaries", "Birthdays"),
  },
  {
    nameKey: "taxonomy.categories.pocketMoney",
    name: "Pocket Money / Snacks",
    macro: "wants",
    icon: "candy",
    subcategories: subs("Convenience store", "Drinks", "Snacks"),
  },
  {
    nameKey: "taxonomy.categories.tech",
    name: "Tech & Gadgets",
    macro: "wants",
    icon: "headphones",
    subcategories: subs("Audio", "Cables & accessories", "Cases"),
  },
  {
    nameKey: "taxonomy.categories.travel",
    name: "Travel & Getaways",
    macro: "wants",
    icon: "plane",
    subcategories: subs("Flights", "Lodging", "Trips"),
  },
  {
    nameKey: "taxonomy.categories.homeFurniture",
    name: "Home & Furniture",
    macro: "wants",
    icon: "sofa",
    subcategories: subs("Appliances", "Decor", "Furniture"),
  },
  {
    nameKey: "taxonomy.categories.hobbies",
    name: "Hobbies & Sports",
    macro: "wants",
    icon: "palette",
    subcategories: subs("Hobbies", "Sports"),
  },
  {
    nameKey: "taxonomy.categories.donations",
    name: "Donations",
    macro: "wants",
    icon: "hand-heart",
    subcategories: subs("Donations"),
  },
  {
    nameKey: "taxonomy.categories.other",
    name: "Other",
    macro: "wants",
    icon: "ellipsis",
    subcategories: subs("Uncategorized"),
  },
];
