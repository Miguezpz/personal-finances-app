"use client";

/**
 * Add an expense (brought forward from T091 for US2; US4 completes card payments).
 * Amount, date (today by default; a past date affects that quincena, US4-2), subcategory grouped by
 * category, payment method and note. The bucket is inherited from the category and only shown.
 * Optimistic: the Safe-to-Spend updates before the server answers (FR-018).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
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
import { isDemoReadOnlyError } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { FinanceSnapshot, Uuid } from "@/domain/types";
import { SubcategoryOptions } from "@/features/settings/taxonomy/SubcategoryOptions";
import { useToday } from "@/lib/use-today";
import { bucketOfSubcategory, useCreateExpense } from "./hooks";
import { expenseFormSchema, type ExpenseFormInput, type ExpenseFormOutput } from "./schemas";

type ExpensesMessageKey = Parameters<ReturnType<typeof useTranslations<"expenses">>>[0];

const selectFormData = (s: FinanceSnapshot) => ({
  categories: s.categories,
  subcategories: s.subcategories.filter((x) => !x.archived),
  accounts: s.accounts.filter((a) => !a.archived),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddExpenseDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("expenses");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const today = useToday();
  const { data } = useFinanceSnapshot(selectFormData);
  const createExpense = useCreateExpense();

  const form = useForm<ExpenseFormInput, unknown, ExpenseFormOutput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: "",
      spentOn: today,
      subcategoryId: "",
      paymentAccountId: "",
      note: "",
    },
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
    createExpense.mutate(
      {
        ...values,
        bucket: inherited,
        origin: "manual",
        recurringExpenseId: null,
        occurrenceDate: null,
      },
      {
        onSuccess: () => toast.success(t("saved")),
        onError: (e) => {
          if (!isDemoReadOnlyError(e)) toast.error(t("saveFailed"));
        },
      },
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>

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
