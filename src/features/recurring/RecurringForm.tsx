"use client";

/**
 * Create / edit a recurring expense (T084, FR-007). Editing only affects future charges: applied
 * ones are snapshots in the history (FR-011). Moving the start date earlier (or creating one in the
 * past) charges the unapplied months in between as soon as it's saved; the form warns how many.
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
import { NativeSelect } from "@/components/ui/native-select";
import { isNotifiedGlobally } from "@/data/errors";
import { isIsoDate } from "@/domain/dates";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { formatCentsAsInput } from "@/domain/parse";
import { retroactiveChargeCount } from "@/domain/recurring";
import type { FinanceSnapshot, IsoDate, RecurringExpense, Uuid } from "@/domain/types";
import { bucketOfSubcategory } from "@/features/expenses/hooks";
import {
  SubcategoryOptions,
  useHasSubcategories,
} from "@/features/settings/taxonomy/SubcategoryOptions";
import { useToday } from "@/lib/use-today";
import { PaymentAccountOptions } from "@/features/settings/accounts/PaymentAccountOptions";
import { useCreateRecurring, useUpdateRecurring } from "./hooks";
import { recurringFormSchema, type RecurringFormInput, type RecurringFormOutput } from "./schemas";

type RecurringMessageKey = Parameters<ReturnType<typeof useTranslations<"recurring">>>[0];

const selectFormData = (s: FinanceSnapshot) => ({
  categories: s.categories,
  subcategories: s.subcategories,
  accounts: s.accounts.filter((a) => !a.archived),
  expenses: s.expenses,
});

/** Past charges that saving the form would create (0 while the inputs are incomplete). */
function retroactiveCountFor(
  recurring: RecurringExpense | null | undefined,
  startsOn: string,
  chargeDay: string,
  expenses: FinanceSnapshot["expenses"] | undefined,
  today: IsoDate,
): number {
  const day = Number(chargeDay);
  if (!expenses || !isIsoDate(startsOn) || !Number.isInteger(day) || day < 1 || day > 31) return 0;
  const draft: RecurringExpense = recurring
    ? { ...recurring, chargeDay: day }
    : {
        id: "draft" as Uuid,
        name: "",
        amount: 0 as RecurringExpense["amount"],
        chargeDay: day,
        subcategoryId: "" as Uuid,
        bucket: "needs",
        paymentAccountId: null,
        startsOn: startsOn as IsoDate,
        endedOn: null,
      };
  return retroactiveChargeCount(draft, startsOn as IsoDate, recurring ? expenses : [], today);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurring?: RecurringExpense | null;
}

export function RecurringForm({ open, onOpenChange, recurring }: Props) {
  const t = useTranslations("recurring");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const today = useToday();
  const { data } = useFinanceSnapshot(selectFormData);
  const hasSubcategories = useHasSubcategories();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const editing = Boolean(recurring);

  const form = useForm<RecurringFormInput, unknown, RecurringFormOutput>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: recurring
      ? {
          name: recurring.name,
          amount: formatCentsAsInput(recurring.amount),
          chargeDay: String(recurring.chargeDay),
          subcategoryId: recurring.subcategoryId,
          paymentAccountId: recurring.paymentAccountId ?? "",
          startsOn: recurring.startsOn,
        }
      : {
          name: "",
          amount: "",
          chargeDay: "1",
          subcategoryId: "",
          paymentAccountId: "",
          startsOn: today,
        },
  });
  const subcategoryId = useWatch({ control: form.control, name: "subcategoryId" });
  const startsOn = useWatch({ control: form.control, name: "startsOn" });
  const chargeDay = useWatch({ control: form.control, name: "chargeDay" });
  const retroactive = retroactiveCountFor(recurring, startsOn, chargeDay, data?.expenses, today);
  const bucket = data && subcategoryId ? bucketOfSubcategory(data, subcategoryId as Uuid) : null;
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as RecurringMessageKey) : null);

  function onSubmit(values: RecurringFormOutput) {
    if (!data) return;
    const inherited = bucketOfSubcategory(data, values.subcategoryId);
    if (!inherited) return;
    const callbacks = {
      onSuccess: () => toast.success(t("saved")),
      onError: (e: Error) => {
        if (!isNotifiedGlobally(e)) toast.error(t("saveFailed"));
      },
    };
    if (recurring) {
      // A paused one can't start after its pause (DB check ended_on >= starts_on).
      if (recurring.endedOn && values.startsOn > recurring.endedOn) {
        form.setError("startsOn", { message: "startsAfterEnd" });
        return;
      }
      // Applies to future charges; an earlier startsOn also charges the unapplied months since.
      const patch = {
        name: values.name,
        amount: values.amount,
        chargeDay: values.chargeDay,
        subcategoryId: values.subcategoryId,
        paymentAccountId: values.paymentAccountId,
        startsOn: values.startsOn,
        bucket: inherited,
      };
      update.mutate({ id: recurring.id, patch }, callbacks);
    } else {
      create.mutate({ ...values, bucket: inherited, endedOn: null }, callbacks);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{editing ? t("editHint") : t("addHint")}</DialogDescription>
        </DialogHeader>

        <form
          id="recurring-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="recurring-name">{t("name")}</FieldLabel>
              <Input
                id="recurring-name"
                maxLength={80}
                placeholder={t("namePlaceholder")}
                {...form.register("name")}
              />
              {errors.name && <FieldError>{errorText(errors.name.message)}</FieldError>}
            </Field>

            <div className="grid grid-cols-[1fr_7rem] gap-4">
              <Field data-invalid={Boolean(errors.amount)}>
                <FieldLabel htmlFor="recurring-amount">{t("amount")}</FieldLabel>
                <Input
                  id="recurring-amount"
                  data-money
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  {...form.register("amount")}
                />
                {errors.amount && <FieldError>{errorText(errors.amount.message)}</FieldError>}
              </Field>
              <Field data-invalid={Boolean(errors.chargeDay)}>
                <FieldLabel htmlFor="recurring-day">{t("chargeDay")}</FieldLabel>
                <Input
                  id="recurring-day"
                  inputMode="numeric"
                  autoComplete="off"
                  {...form.register("chargeDay")}
                />
              </Field>
            </div>
            {errors.chargeDay ? (
              <FieldError>{errorText(errors.chargeDay.message)}</FieldError>
            ) : (
              <FieldDescription>{t("chargeDayHint")}</FieldDescription>
            )}

            <Field data-invalid={Boolean(errors.subcategoryId)}>
              <FieldLabel htmlFor="recurring-subcategory">{t("subcategory")}</FieldLabel>
              <NativeSelect id="recurring-subcategory" {...form.register("subcategoryId")}>
                <SubcategoryOptions placeholder={t("chooseSubcategory")} />
              </NativeSelect>
              {bucket && (
                <FieldDescription>{t("bucketHint", { bucket: tb(bucket) })}</FieldDescription>
              )}
              {errors.subcategoryId && (
                <FieldError>{errorText(errors.subcategoryId.message)}</FieldError>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="recurring-account">{t("paymentMethod")}</FieldLabel>
                <NativeSelect id="recurring-account" {...form.register("paymentAccountId")}>
                  <PaymentAccountOptions
                    accounts={data?.accounts ?? []}
                    placeholder={t("noPaymentMethod")}
                  />
                </NativeSelect>
              </Field>
              <Field data-invalid={Boolean(errors.startsOn)}>
                <FieldLabel htmlFor="recurring-start">{t("startsOn")}</FieldLabel>
                <Input id="recurring-start" type="date" {...form.register("startsOn")} />
                {errors.startsOn ? (
                  <FieldError>{errorText(errors.startsOn.message)}</FieldError>
                ) : (
                  retroactive > 0 && (
                    <FieldDescription data-testid="recurring-retroactive">
                      {t("retroactiveCharges", { count: retroactive })}
                    </FieldDescription>
                  )
                )}
              </Field>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            form="recurring-form"
            disabled={!hasSubcategories}
            data-testid="save-recurring"
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
