"use client";

/**
 * Create or edit a quick expense (spec 005, FR-001/FR-002): name, amount, subcategory (active ones
 * only) and an optional payment method (active accounts). A new template goes last in the row
 * (sort = max + 1). Editing changes future taps only; recorded expenses never change.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
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
import { NativeSelect } from "@/components/ui/native-select";
import { isNotifiedGlobally } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { formatCentsAsInput } from "@/domain/parse";
import { TEMPLATE_NAME_MAX, nextSort } from "@/domain/quick-expenses";
import type { ExpenseTemplate, FinanceSnapshot } from "@/domain/types";
import { SubcategoryOptions } from "@/features/settings/taxonomy/SubcategoryOptions";
import { PaymentAccountOptions } from "@/features/settings/accounts/PaymentAccountOptions";
import { useCreateTemplate, useUpdateTemplate } from "./quick-expense-hooks";
import {
  expenseTemplateFormSchema,
  type ExpenseTemplateFormInput,
  type ExpenseTemplateFormOutput,
} from "./template-schemas";

type QuickMessageKey = Parameters<ReturnType<typeof useTranslations<"quickExpenses">>>[0];

const selectFormData = (s: FinanceSnapshot) => ({
  accounts: s.accounts.filter((a) => !a.archived),
  templates: s.expenseTemplates,
  activeSubcategoryIds: new Set(s.subcategories.filter((x) => !x.archived).map((x) => x.id)),
});

interface Props {
  open: boolean;
  /** null = create a new one. */
  template: ExpenseTemplate | null;
  onOpenChange: (open: boolean) => void;
}

export function QuickExpenseTemplateDialog({ open, template, onOpenChange }: Props) {
  const t = useTranslations("quickExpenses");
  const tc = useTranslations("common");
  const { data } = useFinanceSnapshot(selectFormData);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const form = useForm<ExpenseTemplateFormInput, unknown, ExpenseTemplateFormOutput>({
    resolver: zodResolver(expenseTemplateFormSchema),
    defaultValues: template
      ? {
          name: template.name,
          amount: formatCentsAsInput(template.amount),
          // An archived subcategory must be replaced before saving (FR-011).
          subcategoryId: data?.activeSubcategoryIds.has(template.subcategoryId)
            ? template.subcategoryId
            : "",
          paymentAccountId:
            template.paymentAccountId &&
            data?.accounts.some((a) => a.id === template.paymentAccountId)
              ? template.paymentAccountId
              : "",
        }
      : { name: "", amount: "", subcategoryId: "", paymentAccountId: "" },
  });
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as QuickMessageKey) : null);

  function onSubmit(values: ExpenseTemplateFormOutput) {
    if (!data) return;
    const callbacks = {
      onSuccess: () => toast.success(t("saved")),
      onError: (e: Error) => {
        if (!isNotifiedGlobally(e)) toast.error(t("saveFailed"));
      },
    };
    if (template) {
      updateTemplate.mutate({ id: template.id, patch: values }, callbacks);
    } else {
      createTemplate.mutate(
        { ...values, sort: nextSort(data.templates), archived: false },
        callbacks,
      );
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{template ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>

        <form
          id="quick-expense-template-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="template-name">{t("name")}</FieldLabel>
                <Input
                  id="template-name"
                  autoComplete="off"
                  autoFocus
                  maxLength={TEMPLATE_NAME_MAX}
                  aria-invalid={Boolean(errors.name)}
                  {...form.register("name")}
                />
                {errors.name ? (
                  <FieldError>{errorText(errors.name.message)}</FieldError>
                ) : (
                  <FieldDescription>{t("nameHint")}</FieldDescription>
                )}
              </Field>

              <Field data-invalid={Boolean(errors.amount)}>
                <FieldLabel htmlFor="template-amount">{t("amount")}</FieldLabel>
                <Input
                  id="template-amount"
                  data-money
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="24.00"
                  className="tabular-nums"
                  aria-invalid={Boolean(errors.amount)}
                  {...form.register("amount")}
                />
                {errors.amount && <FieldError>{errorText(errors.amount.message)}</FieldError>}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.subcategoryId)}>
              <FieldLabel htmlFor="template-subcategory">{t("subcategory")}</FieldLabel>
              <NativeSelect
                id="template-subcategory"
                aria-invalid={Boolean(errors.subcategoryId)}
                {...form.register("subcategoryId")}
              >
                <SubcategoryOptions placeholder={t("chooseSubcategory")} />
              </NativeSelect>
              {errors.subcategoryId && (
                <FieldError>{errorText(errors.subcategoryId.message)}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="template-account">{t("paymentMethod")}</FieldLabel>
              <NativeSelect id="template-account" {...form.register("paymentAccountId")}>
                <PaymentAccountOptions
                  accounts={data?.accounts ?? []}
                  placeholder={t("noPaymentMethod")}
                />
              </NativeSelect>
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="quick-expense-template-form" data-testid="save-template">
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
