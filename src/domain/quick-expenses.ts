/**
 * Quick expenses (spec 005): one-tap expense templates. Pure, no React; "today" is always injected.
 *
 * A tap builds a normal manual expense from the template (FR-007): today's business date, the
 * template's amount, subcategory and payment method, and the template name as the note. The bucket
 * is NOT stored in the template; it's taken from the subcategory's category at tap time (FR-003).
 * The template itself never changes (FR-007a).
 */
import type {
  Cents,
  Expense,
  ExpenseTemplate,
  FinanceSnapshot,
  IsoDate,
  SpendBucket,
  Uuid,
} from "./types";

/** Safeguard for the Dashboard row, not a data invariant (FR-005, research R7). */
export const MAX_ACTIVE_TEMPLATES = 12;
/** Same limit as the SQL check on expense_templates.name. */
export const TEMPLATE_NAME_MAX = 40;

type Taxonomy = Pick<FinanceSnapshot, "categories" | "subcategories">;
type TemplateContext = Pick<FinanceSnapshot, "categories" | "subcategories" | "accounts">;

/** Bucket inherited from the subcategory's parent category (FR-014 of spec 001, FR-003). */
export function bucketOfSubcategory(s: Taxonomy, subcategoryId: Uuid): SpendBucket | null {
  const sub = s.subcategories.find((x) => x.id === subcategoryId);
  return s.categories.find((c) => c.id === sub?.categoryId)?.macro ?? null;
}

/** Non-archived templates in the owner's order (`sort`, then `name`). */
export function activeTemplates(templates: readonly ExpenseTemplate[]): ExpenseTemplate[] {
  return templates
    .filter((t) => !t.archived)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export function canAddTemplate(templates: readonly ExpenseTemplate[]): boolean {
  return templates.filter((t) => !t.archived).length < MAX_ACTIVE_TEMPLATES;
}

export type TemplateAvailability =
  { usable: false; reason: "subcategoryArchived" } | { usable: true; accountDropped: boolean };

/**
 * A template whose subcategory (or its category) is archived or gone can't be used until it's
 * edited (FR-011). One whose payment account is archived still works, without a payment method.
 */
export function templateAvailability(
  template: ExpenseTemplate,
  s: TemplateContext,
): TemplateAvailability {
  const sub = s.subcategories.find((x) => x.id === template.subcategoryId);
  const category = s.categories.find((c) => c.id === sub?.categoryId);
  if (!sub || sub.archived || !category || category.archived) {
    return { usable: false, reason: "subcategoryArchived" };
  }
  if (template.paymentAccountId === null) return { usable: true, accountDropped: false };
  const account = s.accounts.find((a) => a.id === template.paymentAccountId);
  return { usable: true, accountDropped: !account || account.archived };
}

export interface QuickExpenseOverrides {
  amount?: Cents;
  spentOn?: IsoDate;
}

/**
 * The manual expense a tap registers, or null when the template can't be used, the date is in the
 * future, the amount isn't positive or the subcategory has no bucket.
 */
export function templateToExpense(
  template: ExpenseTemplate,
  s: TemplateContext,
  today: IsoDate,
  overrides?: QuickExpenseOverrides,
): Omit<Expense, "id"> | null {
  const availability = templateAvailability(template, s);
  if (!availability.usable) return null;
  const amount = overrides?.amount ?? template.amount;
  const spentOn = overrides?.spentOn ?? today;
  if (spentOn > today || !Number.isInteger(amount) || amount <= 0) return null;
  const bucket = bucketOfSubcategory(s, template.subcategoryId);
  if (!bucket) return null;
  return {
    amount,
    spentOn,
    subcategoryId: template.subcategoryId,
    bucket,
    paymentAccountId: availability.accountDropped ? null : template.paymentAccountId,
    note: template.name,
    origin: "manual",
    recurringExpenseId: null,
    occurrenceDate: null,
  };
}

/**
 * "Save as quick expense" (FR-012): the template for a just-saved expense. Its name is the trimmed
 * note or, when empty, the subcategory name, cut to 40 characters. `sort` is set by the caller.
 */
export function templateFromExpense(
  input: Pick<Expense, "amount" | "subcategoryId" | "paymentAccountId" | "note">,
  subcategoryName: string,
): Omit<ExpenseTemplate, "id" | "sort"> {
  const note = input.note?.trim() ?? "";
  const name = (note || subcategoryName.trim()).slice(0, TEMPLATE_NAME_MAX).trim();
  return {
    name,
    amount: input.amount,
    subcategoryId: input.subcategoryId,
    paymentAccountId: input.paymentAccountId,
    archived: false,
  };
}

/** Position for a new template: after the last active one. */
export function nextSort(templates: readonly ExpenseTemplate[]): number {
  const active = templates.filter((t) => !t.archived);
  return active.length === 0 ? 0 : Math.max(...active.map((t) => t.sort)) + 1;
}

/** Moves `id` one place up or down; unchanged at the ends or when `id` isn't in the list. */
export function reorderIds<T extends string>(
  ids: readonly T[],
  id: T,
  direction: "up" | "down",
): T[] {
  const result = [...ids];
  const from = result.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= result.length) return result;
  [result[from], result[to]] = [result[to] as T, result[from] as T];
  return result;
}
