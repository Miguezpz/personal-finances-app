"use client";

/**
 * Pay a credit card (T092, FR-013b): a debt settlement. It lowers the card's debt and never
 * touches Needs/Wants — the purchases already did, on the day they were made.
 * Pre-filled with the "pay to avoid interest" amount ("totalero" mode, FR-029).
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isNotifiedGlobally } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { formatCentsAsInput } from "@/domain/parse";
import type { Cents, FinanceSnapshot, Uuid } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { PaymentAccountOptions } from "@/features/settings/accounts/PaymentAccountOptions";
import { useCreateCardPayment } from "./hooks";
import {
  cardPaymentFormSchema,
  type CardPaymentFormInput,
  type CardPaymentFormOutput,
} from "./schemas";

type ExpensesMessageKey = Parameters<ReturnType<typeof useTranslations<"expenses">>>[0];

const selectAccounts = (s: FinanceSnapshot) => ({
  cards: s.accounts.filter((a) => a.kind === "credit_card" && !a.archived),
  sources: s.accounts.filter((a) => a.kind !== "credit_card" && !a.archived),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId?: Uuid | null;
  suggestedAmount?: Cents | null;
}

export function CardPaymentDialog({ open, onOpenChange, cardId, suggestedAmount }: Props) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const today = useToday();
  const { data } = useFinanceSnapshot(selectAccounts);
  const createPayment = useCreateCardPayment();

  const form = useForm<CardPaymentFormInput, unknown, CardPaymentFormOutput>({
    resolver: zodResolver(cardPaymentFormSchema),
    defaultValues: {
      cardAccountId: cardId ?? "",
      amount: suggestedAmount ? formatCentsAsInput(suggestedAmount) : "",
      paidOn: today,
      fromAccountId: "",
      note: "",
    },
  });
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as ExpensesMessageKey) : null);

  function onSubmit(values: CardPaymentFormOutput) {
    createPayment.mutate(values, {
      onSuccess: () => toast.success(t("paymentSaved")),
      onError: (e) => {
        if (!isNotifiedGlobally(e)) toast.error(t("saveFailed"));
      },
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("payCardTitle")}</DialogTitle>
          <DialogDescription>{t("payCardDescription")}</DialogDescription>
        </DialogHeader>

        <form
          id="card-payment-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.cardAccountId)}>
              <FieldLabel htmlFor="payment-card">{t("card")}</FieldLabel>
              <NativeSelect id="payment-card" {...form.register("cardAccountId")}>
                <NativeSelectOption value="">{t("chooseCard")}</NativeSelectOption>
                {(data?.cards ?? []).map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.cardAccountId && (
                <FieldError>{errorText(errors.cardAccountId.message)}</FieldError>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.amount)}>
                <FieldLabel htmlFor="payment-amount">{t("amount")}</FieldLabel>
                <Input
                  id="payment-amount"
                  data-money
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  {...form.register("amount")}
                />
                {errors.amount && <FieldError>{errorText(errors.amount.message)}</FieldError>}
              </Field>
              <Field data-invalid={Boolean(errors.paidOn)}>
                <FieldLabel htmlFor="payment-date">{t("paidOn")}</FieldLabel>
                <Input id="payment-date" type="date" {...form.register("paidOn")} />
                {errors.paidOn && <FieldError>{errorText(errors.paidOn.message)}</FieldError>}
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="payment-from">{t("paidFrom")}</FieldLabel>
              <NativeSelect id="payment-from" {...form.register("fromAccountId")}>
                <PaymentAccountOptions
                  accounts={data?.sources ?? []}
                  placeholder={t("noPaymentMethod")}
                />
              </NativeSelect>
            </Field>

            <Field data-invalid={Boolean(errors.note)}>
              <FieldLabel htmlFor="payment-note">{t("note")}</FieldLabel>
              <Input id="payment-note" maxLength={200} {...form.register("note")} />
              {errors.note && <FieldError>{errorText(errors.note.message)}</FieldError>}
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="card-payment-form" data-testid="save-card-payment">
            {t("savePayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
