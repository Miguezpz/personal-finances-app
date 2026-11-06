"use client";

/**
 * Add or edit an expense (T091).
 * Amount, date (today by default; a past date affects that quincena, US4-2), subcategory grouped by
 * category, payment method and note. The bucket is inherited from the category and only shown.
 * Optimistic: the Safe-to-Spend updates before the server answers (FR-018).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { isNotifiedGlobally } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { formatCentsAsInput } from "@/domain/parse";
import { canAddTemplate, nextSort, templateFromExpense } from "@/domain/quick-expenses";
import type { Expense, FinanceSnapshot, Uuid } from "@/domain/types";
import { SubcategoryOptions } from "@/features/settings/taxonomy/SubcategoryOptions";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { useToday } from "@/lib/use-today";
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
});

const selectHasActiveTemplates = (s: FinanceSnapshot) =>
  s.expenseTemplates.some((t) => !t.archived);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; the bucket is re-inherited from the (possibly new) subcategory. */
  expense?: Expense | null;
}

export function AddExpenseDialog({ open, onOpenChange, expense }: Props) {
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
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const canSaveTemplate = data ? canAddTemplate(data.templates) : false;

  const form = useForm<ExpenseFormInput, unknown, ExpenseFormOutput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: expense
      ? {
          amount: formatCentsAsInput(expense.amount),
          spentOn: expense.spentOn,
          subcategoryId: expense.subcategoryId,
          paymentAccountId: expense.paymentAccountId ?? "",
          note: expense.note ?? "",
        }
      : { amount: "", spentOn: today, subcategoryId: "", paymentAccountId: "", note: "" },
  });
  const subcategoryId = useWatch({ control: form.control, name: "subcategoryId" });
  const bucket = data && subcategoryId ? bucketOfSubcategory(data, subcategoryId as Uuid) : null;
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as ExpensesMessageKey) : null);
  const hasCategories = (data?.subcategories.length ?? 0) > 0;

  function onSubmit(values: ExpenseFormOutput) {
    if (!data) return;
    const inherited = bucketOfSubcategory(data, values.subcategoryId);
    if (!inherited) return;
    const callbacks = {
      onSuccess: () => toast.success(t("saved")),
      onError: (e: Error) => {
        if (!isNotifiedGlobally(e)) toast.error(t("saveFailed"));
      },
    };
    if (expense) {
      updateExpense.mutate({ id: expense.id, patch: { ...values, bucket: inherited } }, callbacks);
    } else {
      const saved = createExpense.mutateAsync({
        ...values,
        bucket: inherited,
        origin: "manual",
        recurringExpenseId: null,
        occurrenceDate: null,
      });
      saved.then(callbacks.onSuccess, callbacks.onError);
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
    onOpenChange(false);
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
          onSubmit={form.handleSubmit(onSubmit)}
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
                <FieldLabel htmlFor="expense-date">{t("spentOn")}</FieldLabel>
                <Input id="expense-date" type="date" {...form.register("spentOn")} />
                {errors.spentOn && <FieldError>{errorText(errors.spentOn.message)}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="expense-account">{t("paymentMethod")}</FieldLabel>
                <NativeSelect id="expense-account" {...form.register("paymentAccountId")}>
                  <NativeSelectOption value="">{t("noPaymentMethod")}</NativeSelectOption>
                  {(data?.accounts ?? []).map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.name}
                    </NativeSelectOption>
                  ))}
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
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
