"use client";

/**
 * Register an MSI purchase made for someone else (T099, FR-022…024). Live preview of the
 * collection calendar (amount, collect-by date and card due date per installment), computed by the
 * same pure function that is saved; purchase + installments go through the atomic RPC.
 * It is NOT an expense: it never touches Needs/Wants (FR-020).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Money } from "@/components/money/Money";
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
import { isIsoDate } from "@/domain/dates";
import {
  buildCollectionSchedule,
  MAX_TERM_MONTHS,
  type ScheduledInstallment,
} from "@/domain/installments";
import { parseMoneyInput } from "@/domain/parse";
import type { FinanceSnapshot, Uuid } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { useCreateDebtor, useCreateReceivable } from "./hooks";
import {
  receivableFormSchema,
  type ReceivableFormInput,
  type ReceivableFormOutput,
} from "./schemas";

type ReceivablesMessageKey = Parameters<ReturnType<typeof useTranslations<"receivables">>>[0];

const selectFormData = (s: FinanceSnapshot) => ({
  debtors: s.debtors,
  cards: s.accounts.filter((a) => a.kind === "credit_card" && !a.archived),
  leadDays: s.settings.collectionLeadDays,
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddReceivableDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("receivables");
  const tc = useTranslations("common");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const { data } = useFinanceSnapshot(selectFormData);
  const createDebtor = useCreateDebtor();
  const createReceivable = useCreateReceivable();

  const form = useForm<ReceivableFormInput, unknown, ReceivableFormOutput>({
    resolver: zodResolver(receivableFormSchema),
    defaultValues: {
      debtorId: "",
      newDebtorName: "",
      description: "",
      total: "",
      termMonths: "6",
      cardAccountId: "",
      purchaseDate: today,
    },
  });
  const [debtorId, total, termMonths, cardAccountId, purchaseDate] = useWatch({
    control: form.control,
    name: ["debtorId", "total", "termMonths", "cardAccountId", "purchaseDate"],
  });
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as ReceivablesMessageKey) : null);

  const preview = useMemo((): ScheduledInstallment[] | null => {
    const card = data?.cards.find((c) => c.id === cardAccountId);
    const amount = parseMoneyInput(total);
    const term = Number(termMonths);
    if (
      !card ||
      !amount ||
      !Number.isInteger(term) ||
      term < 1 ||
      term > MAX_TERM_MONTHS ||
      !isIsoDate(purchaseDate)
    ) {
      return null;
    }
    try {
      return buildCollectionSchedule(card, amount, term, purchaseDate, data?.leadDays ?? 3);
    } catch {
      return null;
    }
  }, [data, cardAccountId, total, termMonths, purchaseDate]);

  async function onSubmit(values: ReceivableFormOutput) {
    const card = data?.cards.find((c) => c.id === values.cardAccountId);
    if (!card) return;
    const schedule = buildCollectionSchedule(
      card,
      values.total,
      values.termMonths,
      values.purchaseDate,
      data?.leadDays ?? 3,
    );
    onOpenChange(false);
    try {
      const debtorIdToUse: Uuid =
        "id" in values.debtor
          ? values.debtor.id
          : (await createDebtor.mutateAsync({ name: values.debtor.name })).id;
      await createReceivable.mutateAsync({
        receivable: {
          debtorId: debtorIdToUse,
          cardAccountId: values.cardAccountId,
          description: values.description,
          total: values.total,
          termMonths: values.termMonths,
          purchaseDate: values.purchaseDate,
        },
        installments: schedule,
      });
      toast.success(t("saved"));
    } catch (e) {
      if (!isDemoReadOnlyError(e)) toast.error(t("saveFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>

        <form
          id="receivable-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.debtorId)}>
                <FieldLabel htmlFor="receivable-debtor">{t("debtor")}</FieldLabel>
                <NativeSelect id="receivable-debtor" {...form.register("debtorId")}>
                  <NativeSelectOption value="">{t("newDebtor")}</NativeSelectOption>
                  {(data?.debtors ?? []).map((debtor) => (
                    <NativeSelectOption key={debtor.id} value={debtor.id}>
                      {debtor.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.debtorId && <FieldError>{errorText(errors.debtorId.message)}</FieldError>}
              </Field>
              {!debtorId && (
                <Field data-invalid={Boolean(errors.newDebtorName)}>
                  <FieldLabel htmlFor="receivable-debtor-name">{t("newDebtorName")}</FieldLabel>
                  <Input
                    id="receivable-debtor-name"
                    maxLength={80}
                    {...form.register("newDebtorName")}
                  />
                  {errors.newDebtorName && (
                    <FieldError>{errorText(errors.newDebtorName.message)}</FieldError>
                  )}
                </Field>
              )}
            </div>

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="receivable-description">{t("itemDescription")}</FieldLabel>
              <Input
                id="receivable-description"
                maxLength={120}
                placeholder={t("descriptionPlaceholder")}
                {...form.register("description")}
              />
              {errors.description && (
                <FieldError>{errorText(errors.description.message)}</FieldError>
              )}
            </Field>

            <div className="grid grid-cols-[1fr_7rem] gap-4">
              <Field data-invalid={Boolean(errors.total)}>
                <FieldLabel htmlFor="receivable-total">{t("total")}</FieldLabel>
                <Input
                  id="receivable-total"
                  data-money
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  {...form.register("total")}
                />
                {errors.total && <FieldError>{errorText(errors.total.message)}</FieldError>}
              </Field>
              <Field data-invalid={Boolean(errors.termMonths)}>
                <FieldLabel htmlFor="receivable-term">{t("termMonths")}</FieldLabel>
                <Input
                  id="receivable-term"
                  inputMode="numeric"
                  autoComplete="off"
                  {...form.register("termMonths")}
                />
              </Field>
            </div>
            {errors.termMonths && <FieldError>{errorText(errors.termMonths.message)}</FieldError>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.cardAccountId)}>
                <FieldLabel htmlFor="receivable-card">{t("card")}</FieldLabel>
                <NativeSelect id="receivable-card" {...form.register("cardAccountId")}>
                  <NativeSelectOption value="">{t("chooseCard")}</NativeSelectOption>
                  {(data?.cards ?? []).map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {(data?.cards.length ?? 0) === 0 && (
                  <FieldDescription>{t("noCards")}</FieldDescription>
                )}
                {errors.cardAccountId && (
                  <FieldError>{errorText(errors.cardAccountId.message)}</FieldError>
                )}
              </Field>
              <Field data-invalid={Boolean(errors.purchaseDate)}>
                <FieldLabel htmlFor="receivable-date">{t("purchaseDate")}</FieldLabel>
                <Input id="receivable-date" type="date" {...form.register("purchaseDate")} />
                {errors.purchaseDate && (
                  <FieldError>{errorText(errors.purchaseDate.message)}</FieldError>
                )}
              </Field>
            </div>
          </FieldGroup>

          <section aria-labelledby="schedule-preview" className="rounded-lg border p-3">
            <h3 id="schedule-preview" className="mb-2 text-sm font-medium">
              {t("schedulePreview")}
            </h3>
            {preview ? (
              <table className="w-full text-sm" data-testid="schedule-preview">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 font-normal">#</th>
                    <th className="py-1 font-normal">{t("collectBy")}</th>
                    <th className="py-1 font-normal">{t("cardDue")}</th>
                    <th className="py-1 text-right font-normal">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((i) => (
                    <tr key={i.seq} className="border-t">
                      <td className="py-1">{i.seq}</td>
                      <td className="py-1">{formatDate(i.dueOn, locale, "short")}</td>
                      <td className="py-1 text-muted-foreground">
                        {formatDate(i.cardDueOn, locale, "short")}
                      </td>
                      <td className="py-1 text-right">
                        <Money cents={i.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">{t("previewHint")}</p>
            )}
          </section>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="receivable-form" data-testid="save-receivable">
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
