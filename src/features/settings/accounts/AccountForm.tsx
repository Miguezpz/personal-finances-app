"use client";

/**
 * Create / edit an account or card (T122). The kind is fixed once created (history and card
 * statements depend on it); card fields only appear for credit cards.
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
import { isNotifiedGlobally, isProviderError } from "@/data/errors";
import { formatCentsAsInput } from "@/domain/parse";
import type { Account } from "@/domain/types";
import { useCreateAccount, useUpdateAccount } from "./hooks";
import {
  ACCOUNT_KINDS,
  accountFormSchema,
  type AccountFormInput,
  type AccountFormOutput,
} from "./schema";

type SettingsMessageKey = Parameters<ReturnType<typeof useTranslations<"settings">>>[0];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  /** Names already in use (the database keeps them unique per user). */
  takenNames: readonly string[];
}

export function AccountForm({ open, onOpenChange, account, takenNames }: Props) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const editing = Boolean(account);

  const form = useForm<AccountFormInput, unknown, AccountFormOutput>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: account
      ? {
          kind: account.kind,
          name: account.name,
          institution: account.institution ?? "",
          cutOffDay: account.cutOffDay === null ? "" : String(account.cutOffDay),
          paymentDueOffsetDays:
            account.paymentDueOffsetDays === null ? "" : String(account.paymentDueOffsetDays),
          openingBalance: formatCentsAsInput(account.openingBalance),
        }
      : {
          kind: "checking",
          name: "",
          institution: "",
          cutOffDay: "",
          paymentDueOffsetDays: "20",
          openingBalance: "",
        },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as SettingsMessageKey) : null);

  function onSubmit(values: AccountFormOutput) {
    const lower = values.name.toLocaleLowerCase();
    if (takenNames.some((n) => n.toLocaleLowerCase() === lower)) {
      form.setError("name", { message: "nameTaken" });
      return;
    }
    const callbacks = {
      onSuccess: () => toast.success(t("accountSaved")),
      onError: (e: Error) => {
        if (isNotifiedGlobally(e)) return;
        toast.error(isProviderError(e, "CONFLICT") ? t("nameTaken") : t("saveFailed"));
      },
    };
    if (account) {
      // The kind is fixed once created (statements and history depend on it).
      const patch = {
        name: values.name,
        institution: values.institution,
        cutOffDay: values.cutOffDay,
        paymentDueOffsetDays: values.paymentDueOffsetDays,
        openingBalance: values.openingBalance,
      };
      update.mutate({ id: account.id, patch }, callbacks);
    } else {
      create.mutate({ ...values, archived: false }, callbacks);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("editAccount") : t("addAccount")}</DialogTitle>
          <DialogDescription>{t("accountFormHint")}</DialogDescription>
        </DialogHeader>

        <form
          id="account-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="account-kind">{t("accountKind")}</FieldLabel>
              <NativeSelect id="account-kind" disabled={editing} {...form.register("kind")}>
                {ACCOUNT_KINDS.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {editing && <FieldDescription>{t("kindFixed")}</FieldDescription>}
            </Field>

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="account-name">{t("accountName")}</FieldLabel>
              <Input
                id="account-name"
                maxLength={60}
                placeholder={t("accountNamePlaceholder")}
                {...form.register("name")}
              />
              {errors.name && <FieldError>{errorText(errors.name.message)}</FieldError>}
            </Field>

            <Field data-invalid={Boolean(errors.institution)}>
              <FieldLabel htmlFor="account-institution">{t("institution")}</FieldLabel>
              <Input id="account-institution" maxLength={60} {...form.register("institution")} />
              {errors.institution && (
                <FieldError>{errorText(errors.institution.message)}</FieldError>
              )}
            </Field>

            {kind === "credit_card" && (
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={Boolean(errors.cutOffDay)}>
                  <FieldLabel htmlFor="account-cutoff">{t("cutOffDay")}</FieldLabel>
                  <Input
                    id="account-cutoff"
                    inputMode="numeric"
                    autoComplete="off"
                    {...form.register("cutOffDay")}
                  />
                  {errors.cutOffDay && (
                    <FieldError>{errorText(errors.cutOffDay.message)}</FieldError>
                  )}
                </Field>
                <Field data-invalid={Boolean(errors.paymentDueOffsetDays)}>
                  <FieldLabel htmlFor="account-due">{t("dueOffset")}</FieldLabel>
                  <Input
                    id="account-due"
                    inputMode="numeric"
                    autoComplete="off"
                    {...form.register("paymentDueOffsetDays")}
                  />
                  {errors.paymentDueOffsetDays && (
                    <FieldError>{errorText(errors.paymentDueOffsetDays.message)}</FieldError>
                  )}
                </Field>
                <FieldDescription className="col-span-2">{t("cardHint")}</FieldDescription>
              </div>
            )}

            <Field data-invalid={Boolean(errors.openingBalance)}>
              <FieldLabel htmlFor="account-opening">{t("openingBalance")}</FieldLabel>
              <Input
                id="account-opening"
                data-money
                inputMode="decimal"
                autoComplete="off"
                className="tabular-nums"
                {...form.register("openingBalance")}
              />
              {errors.openingBalance ? (
                <FieldError>{errorText(errors.openingBalance.message)}</FieldError>
              ) : (
                <FieldDescription>{t("openingBalanceHint")}</FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="account-form" data-testid="save-account">
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
