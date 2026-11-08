"use client";

/**
 * Add or edit an expense (T091).
 * Amount, date (today by default; a past date affects that quincena, US4-2), subcategory grouped by
 * category, payment method and note. The bucket is inherited from the category and only shown.
 * Optimistic: the Safe-to-Spend updates before the server answers (FR-018).
 *
 * Spec 009: the last account and subcategory are prefilled (FR-001/FR-002); the date is a Today /
 * Yesterday / Other choice (FR-004); recent subcategories are one-tap chips (FR-005); "Save and add
 * another" (also Shift+Enter) keeps the dialog open (FR-006); a failed save offers "Retry" with
 * what was typed (FR-008); editing has "Delete", with Undo instead of a confirmation (FR-015).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { isNotifiedGlobally } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { addDays } from "@/domain/dates";
import { formatCentsAsInput } from "@/domain/parse";
import { recentSubcategories } from "@/domain/recent";
import { canAddTemplate, nextSort, templateFromExpense } from "@/domain/quick-expenses";
import type { Expense, FinanceSnapshot, Uuid } from "@/domain/types";
import { SubcategoryOptions } from "@/features/settings/taxonomy/SubcategoryOptions";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { useToday } from "@/lib/use-today";
import { PaymentAccountOptions } from "@/features/settings/accounts/PaymentAccountOptions";
import { rememberLastUsed, useLastUsedDefaults } from "@/features/shared/last-used";
import { notifySaveFailed } from "@/features/shared/retry-toast";
import { useDeferredDelete } from "@/features/shared/use-deferred-delete";
import { bucketOfSubcategory, useCreateExpense, useUpdateExpense } from "./hooks";
import { QuickExpenseBar } from "./QuickExpenseBar";
import { useCreateTemplate } from "./quick-expense-hooks";
import { expenseFormSchema, type ExpenseFormInput, type ExpenseFormOutput } from "./schemas";

type ExpensesMessageKey = Parameters<ReturnType<typeof useTranslations<"expenses">>>[0];

const selectFormData = (s: FinanceSnapshot) => ({
  categories: s.categories,
  subcategories: s.subcategories.filter((x) => !x.archived),
  accounts: s.accounts.filter((a) => !a.archived),
  templates: s.expenseTemplates,
  recent: recentSubcategories(s.expenses, s.subcategories),
});

const selectHasActiveTemplates = (s: FinanceSnapshot) =>
  s.expenseTemplates.some((t) => !t.archived);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; the bucket is re-inherited from the (possibly new) subcategory. */
  expense?: Expense | null;
  /** What was typed when a save failed ("Retry", spec 009). */
  draft?: Partial<ExpenseFormInput>;
}

type DateChoice = "today" | "yesterday" | "other";

export function AddExpenseDialog({ open, onOpenChange, expense, draft }: Props) {
  const t = useTranslations("expenses");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const tq = useTranslations("quickExpenses");
  const nameOf = useTaxonomyName();
  const today = useToday();
  const { data } = useFinanceSnapshot(selectFormData);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const createTemplate = useCreateTemplate();
  const { remove } = useDeferredDelete();
  const lastUsed = useLastUsedDefaults();
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const canSaveTemplate = data ? canAddTemplate(data.templates) : false;
  const yesterday = addDays(today, -1);

  const initial = useMemo<ExpenseFormInput>(
    () => ({
      ...(expense
        ? {
            amount: formatCentsAsInput(expense.amount),
            spentOn: expense.spentOn,
            subcategoryId: expense.subcategoryId,
            paymentAccountId: expense.paymentAccountId ?? "",
            note: expense.note ?? "",
          }
        : {
            amount: "",
            spentOn: today,
            subcategoryId: lastUsed.subcategoryId,
            paymentAccountId: lastUsed.paymentAccountId,
            note: "",
          }),
      ...draft,
    }),
    // The form's initial values are read once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const form = useForm<ExpenseFormInput, unknown, ExpenseFormOutput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initial,
  });
  const subcategoryId = useWatch({ control: form.control, name: "subcategoryId" });
  const [dateChoice, setDateChoice] = useState<DateChoice>(() =>
    initial.spentOn === today ? "today" : initial.spentOn === yesterday ? "yesterday" : "other",
  );
  const chooseDate = (choice: DateChoice) => {
    setDateChoice(choice);
    if (choice === "today") form.setValue("spentOn", today, { shouldValidate: true });
    if (choice === "yesterday") form.setValue("spentOn", yesterday, { shouldValidate: true });
  };
  const bucket = data && subcategoryId ? bucketOfSubcategory(data, subcategoryId as Uuid) : null;
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as ExpensesMessageKey) : null);
  const hasCategories = (data?.subcategories.length ?? 0) > 0;

  function onSubmit(values: ExpenseFormOutput, keepOpen = false) {
    if (!data) return;
    if (values.spentOn > today) {
      form.setError("spentOn", { message: "invalidDate" });
      return;
    }
    const inherited = bucketOfSubcategory(data, values.subcategoryId);
    if (!inherited) return;
    const typed = form.getValues();
    const onSuccess = () => {
      toast.success(keepOpen ? t("savedAddAnother") : t("saved"));
      rememberLastUsed({
        paymentAccountId: values.paymentAccountId,
        subcategoryId: values.subcategoryId,
      });
    };
    const onError = (e: unknown) =>
      notifySaveFailed(
        e,
        { kind: "expense", expense: expense ?? null, draft: typed },
        { failed: t("saveFailed"), retry: tc("retry") },
      );
    if (expense) {
      updateExpense
        .mutateAsync({ id: expense.id, patch: { ...values, bucket: inherited } })
        .then(onSuccess, onError);
    } else {
      const saved = createExpense.mutateAsync({
        ...values,
        bucket: inherited,
        origin: "manual",
        recurringExpenseId: null,
        occurrenceDate: null,
      });
      saved.then(onSuccess, onError);
      // Spec 005 (FR-012): the template is created once the expense is saved. Promises, not
      // per-call callbacks: the dialog unmounts right after submitting.
      if (saveAsTemplate && canSaveTemplate) {
        const sub = data.subcategories.find((x) => x.id === values.subcategoryId);
        const template = {
          ...templateFromExpense(values, sub ? nameOf(sub) : ""),
          sort: nextSort(data.templates),
        };
        saved
          .then(() => createTemplate.mutateAsync(template))
          .then(
            () => toast.success(tq("saved")),
            (e: unknown) => {
              if (!isNotifiedGlobally(e)) toast.error(tq("saveFailed"));
            },
          );
      }
    }
    if (keepOpen && !expense) {
      // FR-006: ready for the next one — same account, subcategory and date.
      setSaveAsTemplate(false);
      form.reset({ ...typed, amount: "", note: "" });
      form.setFocus("amount");
      return;
    }
    onOpenChange(false);
  }

  const saveAndAdd = form.handleSubmit((values) => onSubmit(values, true));

  function deleteExpense() {
    if (!expense) return;
    onOpenChange(false);
    const sub = data?.subcategories.find((x) => x.id === expense.subcategoryId);
    remove({
      kind: "expense",
      id: expense.id,
      label: t("deletedItem", { name: expense.note ?? (sub ? nameOf(sub) : "") }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>

        {/* Spec 005 (FR-006a): new expenses only; a tap records it and closes the dialog. */}
        {!expense && <NewExpenseQuickRow onApplied={() => onOpenChange(false)} />}

        <form
          id="expense-form"
          onSubmit={form.handleSubmit((values) => onSubmit(values))}
          onKeyDown={(e) => {
            // FR-006: Shift+Enter saves and keeps the dialog open for the next expense.
            if (!expense && e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              void saveAndAdd();
            }
          }}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.amount)}>
              <FieldLabel htmlFor="expense-amount">{t("amount")}</FieldLabel>
              <Input
                id="expense-amount"
                data-money
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder="250.00"
                className="tabular-nums"
                {...form.register("amount")}
              />
              {errors.amount && <FieldError>{errorText(errors.amount.message)}</FieldError>}
            </Field>

            <Field data-invalid={Boolean(errors.subcategoryId)}>
              <FieldLabel htmlFor="expense-subcategory">{t("subcategory")}</FieldLabel>
              {data && data.recent.length > 0 && (
                <div
                  role="group"
                  aria-label={t("recent")}
                  className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5"
                >
                  {data.recent.map((sub) => (
                    <Chip
                      key={sub.id}
                      pressed={subcategoryId === sub.id}
                      data-testid="recent-subcategory"
                      onClick={() =>
                        form.setValue("subcategoryId", sub.id, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    >
                      {nameOf(sub)}
                    </Chip>
                  ))}
                </div>
              )}
              <NativeSelect id="expense-subcategory" {...form.register("subcategoryId")}>
                <SubcategoryOptions placeholder={t("chooseSubcategory")} />
              </NativeSelect>
              {!hasCategories && <FieldDescription>{t("noCategoriesYet")}</FieldDescription>}
              {bucket && (
                <FieldDescription data-testid="expense-bucket">
                  {t("bucketHint", { bucket: tb(bucket) })}
                </FieldDescription>
              )}
              {errors.subcategoryId && (
                <FieldError>{errorText(errors.subcategoryId.message)}</FieldError>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.spentOn)}>
                <FieldLabel id="expense-date-label">{t("spentOn")}</FieldLabel>
                <div role="group" aria-labelledby="expense-date-label" className="flex gap-2">
                  {(["today", "yesterday", "other"] as const).map((choice) => (
                    <Chip
                      key={choice}
                      pressed={dateChoice === choice}
                      data-testid={`date-chip-${choice}`}
                      onClick={() => chooseDate(choice)}
                    >
                      {t(
                        choice === "today"
                          ? "dateToday"
                          : choice === "yesterday"
                            ? "dateYesterday"
                            : "dateOther",
                      )}
                    </Chip>
                  ))}
                </div>
                {dateChoice === "other" && (
                  <Input
                    id="expense-date"
                    type="date"
                    max={today}
                    aria-labelledby="expense-date-label"
                    {...form.register("spentOn")}
                  />
                )}
                {dateChoice !== "other" && <input type="hidden" {...form.register("spentOn")} />}
                {errors.spentOn && <FieldError>{errorText(errors.spentOn.message)}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="expense-account">{t("paymentMethod")}</FieldLabel>
                <NativeSelect id="expense-account" {...form.register("paymentAccountId")}>
                  <PaymentAccountOptions
                    accounts={data?.accounts ?? []}
                    placeholder={t("noPaymentMethod")}
                  />
                </NativeSelect>
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.note)}>
              <FieldLabel htmlFor="expense-note">{t("note")}</FieldLabel>
              <Input id="expense-note" maxLength={200} {...form.register("note")} />
              {errors.note && <FieldError>{errorText(errors.note.message)}</FieldError>}
            </Field>

            {!expense && (
              <Field>
                <div className="flex items-center gap-3">
                  <Switch
                    id="expense-save-template"
                    checked={saveAsTemplate && canSaveTemplate}
                    onCheckedChange={setSaveAsTemplate}
                    disabled={!canSaveTemplate}
                    aria-describedby={canSaveTemplate ? undefined : "expense-save-template-limit"}
                    data-testid="save-as-template"
                  />
                  <Label htmlFor="expense-save-template">{tq("saveAsTemplate")}</Label>
                </div>
                {data && !canSaveTemplate && (
                  <FieldDescription id="expense-save-template-limit">
                    {tq("limitReached")}
                  </FieldDescription>
                )}
              </Field>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          {expense && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive sm:mr-auto"
              onClick={deleteExpense}
              data-testid="delete-expense"
            >
              <Trash2 aria-hidden="true" />
              {t("delete")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          {!expense && (
            <Button
              type="button"
              variant="outline"
              className="max-md:hidden"
              disabled={!hasCategories}
              onClick={() => void saveAndAdd()}
              data-testid="save-and-add"
              title="Shift+Enter"
            >
              {t("saveAndAdd")}
            </Button>
          )}
          <Button
            type="submit"
            form="expense-form"
            disabled={!hasCategories}
            data-testid="save-expense"
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The quick expense row plus its separator; renders nothing without active templates. */
function NewExpenseQuickRow({ onApplied }: { onApplied: () => void }) {
  const { data: hasTemplates } = useFinanceSnapshot(selectHasActiveTemplates);
  if (!hasTemplates) return null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <QuickExpenseBar variant="dialog" onApplied={onApplied} />
      <Separator />
    </div>
  );
}
