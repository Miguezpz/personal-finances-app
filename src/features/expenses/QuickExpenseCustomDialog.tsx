"use client";

/**
 * "Record with another amount or date" (spec 005, FR-007a): the template's expense with the amount
 * and date prefilled (template amount, today). The date can't be in the future. Subcategory,
 * payment method and note come from the template and are only shown. The template never changes.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { formatCentsAsInput } from "@/domain/parse";
import type { ExpenseTemplate, FinanceSnapshot } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { useToday } from "@/lib/use-today";
import { useQuickExpense } from "./quick-expense-hooks";
import {
  makeQuickExpenseOverrideSchema,
  type QuickExpenseOverrideInput,
  type QuickExpenseOverrideOutput,
} from "./template-schemas";

type QuickMessageKey = Parameters<ReturnType<typeof useTranslations<"quickExpenses">>>[0];

const selectContext = (s: FinanceSnapshot) => ({
  subcategories: s.subcategories,
  accounts: s.accounts,
});

interface Props {
  template: ExpenseTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after recording (the new-expense dialog closes itself with it). */
  onApplied?: (() => void) | undefined;
}

export function QuickExpenseCustomDialog({ template, open, onOpenChange, onApplied }: Props) {
  const t = useTranslations("quickExpenses");
  const tc = useTranslations("common");
  const today = useToday();
  const nameOf = useTaxonomyName();
  const { data } = useFinanceSnapshot(selectContext);
  const { apply } = useQuickExpense();
  const schema = useMemo(() => makeQuickExpenseOverrideSchema(today), [today]);

  const form = useForm<QuickExpenseOverrideInput, unknown, QuickExpenseOverrideOutput>({
    resolver: zodResolver(schema),
    defaultValues: { amount: formatCentsAsInput(template.amount), spentOn: today },
  });
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as QuickMessageKey) : null);

  const sub = data?.subcategories.find((s) => s.id === template.subcategoryId);
  const account = data?.accounts.find((a) => a.id === template.paymentAccountId && !a.archived);

  function onSubmit(values: QuickExpenseOverrideOutput) {
    apply(template, values);
    onOpenChange(false);
    onApplied?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("customTitle", { name: template.name })}</DialogTitle>
          <DialogDescription>{t("customDescription")}</DialogDescription>
        </DialogHeader>

        <form
          id="quick-expense-custom-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.amount)}>
                <FieldLabel htmlFor="quick-expense-amount">{t("amount")}</FieldLabel>
                <Input
                  id="quick-expense-amount"
                  data-money
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  className="tabular-nums"
                  aria-invalid={Boolean(errors.amount)}
                  {...form.register("amount")}
                />
                {errors.amount && <FieldError>{errorText(errors.amount.message)}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.spentOn)}>
                <FieldLabel htmlFor="quick-expense-date">{t("date")}</FieldLabel>
                <Input
                  id="quick-expense-date"
                  type="date"
                  max={today}
                  aria-invalid={Boolean(errors.spentOn)}
                  {...form.register("spentOn")}
                />
                {errors.spentOn && <FieldError>{errorText(errors.spentOn.message)}</FieldError>}
              </Field>
            </div>
          </FieldGroup>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("subcategory")}</dt>
            <dd className="min-w-0 truncate">{sub ? nameOf(sub) : null}</dd>
            <dt className="text-muted-foreground">{t("paymentMethod")}</dt>
            <dd className="min-w-0 truncate">{account ? account.name : t("noPaymentMethod")}</dd>
            <dt className="text-muted-foreground">{t("note")}</dt>
            <dd className="min-w-0 truncate">{template.name}</dd>
          </dl>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            form="quick-expense-custom-form"
            data-testid="quick-expense-register"
          >
            {t("register")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
