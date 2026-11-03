"use client";

/**
 * Record a collection for one installment (T100, FR-026/026a): fully collected, partial, or back
 * to pending. The money is "earmarked for the card payment": it only lowers what the debtor owes
 * and never enters Needs/Wants or the Safe-to-Spend.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Money } from "@/components/money/Money";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isDemoReadOnlyError } from "@/data/errors";
import { formatCentsAsInput, parseMoneyInput } from "@/domain/parse";
import type { Cents, Installment, IsoDate } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { useRecordCollection } from "./hooks";
import { collectionFormSchema, type CollectionFormInput } from "./schemas";

type ReceivablesMessageKey = Parameters<ReturnType<typeof useTranslations<"receivables">>>[0];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: Installment;
  debtorName: string;
  cardName: string;
}

export function CollectionDialog({ open, onOpenChange, installment, debtorName, cardName }: Props) {
  const t = useTranslations("receivables");
  const tc = useTranslations("common");
  const today = useToday();
  const record = useRecordCollection();

  const form = useForm<CollectionFormInput>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      mode: installment.status === "collected" ? "pending" : "full",
      partialAmount: installment.collected > 0 ? formatCentsAsInput(installment.collected) : "",
      collectedOn: (installment.collectedOn ?? today) as string,
    },
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const errors = form.formState.errors;

  function onSubmit(values: CollectionFormInput) {
    let collected: number;
    if (values.mode === "full") collected = installment.amount;
    else if (values.mode === "pending") collected = 0;
    else {
      collected = parseMoneyInput(values.partialAmount) ?? 0;
      if (collected >= installment.amount) collected = installment.amount;
    }
    record.mutate(
      {
        installmentId: installment.id,
        collected: collected as Cents,
        collectedOn: values.collectedOn as IsoDate,
      },
      {
        onSuccess: () => toast.success(t("collectionSaved")),
        onError: (e) => {
          if (!isDemoReadOnlyError(e)) toast.error(t("saveFailed"));
        },
      },
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("collectionTitle", { seq: installment.seq, debtor: debtorName })}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            {t("installmentAmount")} <Money cents={installment.amount} />
          </DialogDescription>
        </DialogHeader>

        <form
          id="collection-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Controller
              name="mode"
              control={form.control}
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">{t("collectionStatus")}</FieldLegend>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex flex-col gap-2"
                  >
                    {(["full", "partial", "pending"] as const).map((m) => (
                      <div key={m} className="flex items-center gap-2">
                        <RadioGroupItem id={`collection-${m}`} value={m} />
                        <Label htmlFor={`collection-${m}`}>{t(`mode.${m}`)}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FieldSet>
              )}
            />

            {mode === "partial" && (
              <Field data-invalid={Boolean(errors.partialAmount)}>
                <FieldLabel htmlFor="collection-amount">{t("collectedAmount")}</FieldLabel>
                <Input
                  id="collection-amount"
                  data-money
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  {...form.register("partialAmount")}
                />
                {errors.partialAmount?.message && (
                  <FieldError>
                    {t(errors.partialAmount.message as ReceivablesMessageKey)}
                  </FieldError>
                )}
              </Field>
            )}

            {mode !== "pending" && (
              <Field>
                <FieldLabel htmlFor="collection-date">{t("collectedOn")}</FieldLabel>
                <Input id="collection-date" type="date" {...form.register("collectedOn")} />
              </Field>
            )}
          </FieldGroup>

          <Alert>
            <AlertDescription>{t("earmarked", { card: cardName })}</AlertDescription>
          </Alert>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="collection-form" data-testid="save-collection">
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
