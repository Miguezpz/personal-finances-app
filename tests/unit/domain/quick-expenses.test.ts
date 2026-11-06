/**
 * Spec 005 (T007) · Quick expenses: active order, the 12 limit, the expense a tap builds (today,
 * note = name, bucket from the category, overrides, archived subcategory/account), the template
 * built from an expense, the next sort and up/down reordering.
 */
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import {
  MAX_ACTIVE_TEMPLATES,
  activeTemplates,
  bucketOfSubcategory,
  canAddTemplate,
  nextSort,
  reorderIds,
  templateAvailability,
  templateFromExpense,
  templateToExpense,
} from "@/domain/quick-expenses";
import {
  d,
  emptySnapshot,
  makeAccount,
  makeCard,
  makeCategory,
  makeSubcategory,
  makeTemplate,
} from "../../utils/fixtures";

const transport = makeCategory({ name: "Transport & Gas", macro: "needs" });
const leisure = makeCategory({ name: "Leisure", macro: "wants" });
const publicTransport = makeSubcategory({ categoryId: transport.id, name: "Public transport" });
const cinema = makeSubcategory({ categoryId: leisure.id, name: "Cinema" });
const card = makeCard();
const snapshot = emptySnapshot({
  categories: [transport, leisure],
  subcategories: [publicTransport, cinema],
  accounts: [card],
});
const today = d("2026-11-05");
const template = makeTemplate({
  name: "Transporte",
  amount: cents(2400),
  subcategoryId: publicTransport.id,
  paymentAccountId: card.id,
});

describe("activeTemplates", () => {
  it("drops archived templates and orders by sort, then name", () => {
    const a = makeTemplate({ name: "Zeta", sort: 1 });
    const b = makeTemplate({ name: "Alfa", sort: 1 });
    const c = makeTemplate({ name: "Café", sort: 0 });
    const gone = makeTemplate({ name: "Gone", sort: 0, archived: true });
    expect(activeTemplates([a, gone, b, c]).map((t) => t.name)).toEqual(["Café", "Alfa", "Zeta"]);
  });

  it("does not mutate its input", () => {
    const list = [makeTemplate({ sort: 2 }), makeTemplate({ sort: 1 })];
    const before = list.map((t) => t.id);
    activeTemplates(list);
    expect(list.map((t) => t.id)).toEqual(before);
  });
});

describe("canAddTemplate", () => {
  const many = (n: number, archived = false) =>
    Array.from({ length: n }, (_, i) => makeTemplate({ sort: i, archived }));

  it("allows up to 12 active templates", () => {
    expect(MAX_ACTIVE_TEMPLATES).toBe(12);
    expect(canAddTemplate([])).toBe(true);
    expect(canAddTemplate(many(11))).toBe(true);
    expect(canAddTemplate(many(12))).toBe(false);
  });

  it("does not count archived templates", () => {
    expect(canAddTemplate([...many(11), ...many(5, true)])).toBe(true);
  });
});

describe("templateToExpense", () => {
  it("builds a manual expense for today with the template's data and name as note", () => {
    expect(templateToExpense(template, snapshot, today)).toEqual({
      amount: 2400,
      spentOn: "2026-11-05",
      subcategoryId: publicTransport.id,
      bucket: "needs",
      paymentAccountId: card.id,
      note: "Transporte",
      origin: "manual",
      recurringExpenseId: null,
      occurrenceDate: null,
    });
  });

  it("takes the bucket from the subcategory's category at tap time (FR-003)", () => {
    const wants = makeTemplate({ subcategoryId: cinema.id });
    expect(templateToExpense(wants, snapshot, today)?.bucket).toBe("wants");
  });

  it("applies amount and date overrides without touching the template", () => {
    const copy = { ...template };
    const expense = templateToExpense(template, snapshot, today, {
      amount: cents(1200),
      spentOn: d("2026-11-04"),
    });
    expect(expense).toMatchObject({ amount: 1200, spentOn: "2026-11-04", note: "Transporte" });
    expect(template).toEqual(copy);
  });

  it("returns null for a future date or a non-positive amount", () => {
    expect(templateToExpense(template, snapshot, today, { spentOn: d("2026-11-06") })).toBeNull();
    expect(templateToExpense(template, snapshot, today, { amount: cents(0) })).toBeNull();
    expect(templateToExpense(template, snapshot, today, { amount: cents(-100) })).toBeNull();
  });

  it("returns null when the subcategory or its category is archived", () => {
    const archivedSub = { ...snapshot, subcategories: [{ ...publicTransport, archived: true }] };
    expect(templateToExpense(template, archivedSub, today)).toBeNull();
    const archivedCat = { ...snapshot, categories: [{ ...transport, archived: true }, leisure] };
    expect(templateToExpense(template, archivedCat, today)).toBeNull();
    expect(templateAvailability(template, archivedSub)).toEqual({
      usable: false,
      reason: "subcategoryArchived",
    });
  });

  it("registers without a payment method when the account is archived", () => {
    const archived = { ...snapshot, accounts: [{ ...card, archived: true }] };
    expect(templateAvailability(template, archived)).toEqual({
      usable: true,
      accountDropped: true,
    });
    expect(templateToExpense(template, archived, today)?.paymentAccountId).toBeNull();
  });

  it("keeps a null payment method as-is", () => {
    const cash = makeTemplate({ subcategoryId: publicTransport.id, paymentAccountId: null });
    expect(templateAvailability(cash, snapshot)).toEqual({ usable: true, accountDropped: false });
    expect(templateToExpense(cash, snapshot, today)?.paymentAccountId).toBeNull();
  });
});

describe("bucketOfSubcategory", () => {
  it("returns the parent category's macro, or null for an unknown subcategory", () => {
    expect(bucketOfSubcategory(snapshot, publicTransport.id)).toBe("needs");
    expect(bucketOfSubcategory(snapshot, makeAccount().id)).toBeNull();
  });
});

describe("templateFromExpense", () => {
  const base = {
    amount: cents(2400),
    subcategoryId: publicTransport.id,
    paymentAccountId: card.id,
  };

  it("uses the trimmed note as the name", () => {
    expect(templateFromExpense({ ...base, note: "  Transporte  " }, "Public transport")).toEqual({
      name: "Transporte",
      amount: 2400,
      subcategoryId: publicTransport.id,
      paymentAccountId: card.id,
      archived: false,
    });
  });

  it("falls back to the subcategory name without a note", () => {
    expect(templateFromExpense({ ...base, note: null }, "Public transport").name).toBe(
      "Public transport",
    );
    expect(templateFromExpense({ ...base, note: "   " }, "Public transport").name).toBe(
      "Public transport",
    );
  });

  it("cuts a long note to 40 characters", () => {
    const name = templateFromExpense({ ...base, note: "x".repeat(60) }, "Public transport").name;
    expect(name).toHaveLength(40);
  });
});

describe("nextSort", () => {
  it("is 0 without active templates and max(sort) + 1 otherwise", () => {
    expect(nextSort([])).toBe(0);
    expect(nextSort([makeTemplate({ sort: 9, archived: true })])).toBe(0);
    expect(nextSort([makeTemplate({ sort: 0 }), makeTemplate({ sort: 3 })])).toBe(4);
  });
});

describe("reorderIds", () => {
  const ids = ["a", "b", "c"];

  it("moves an id one place up or down", () => {
    expect(reorderIds(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(reorderIds(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("leaves the list unchanged at the ends or for an unknown id", () => {
    expect(reorderIds(ids, "a", "up")).toEqual(ids);
    expect(reorderIds(ids, "c", "down")).toEqual(ids);
    expect(reorderIds(ids, "z", "up")).toEqual(ids);
  });
});
