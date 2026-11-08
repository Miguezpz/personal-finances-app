"use client";

/**
 * Create / edit an account or card (T122). The kind can change while no recorded history depends
 * on it (domain/account-kind.ts); otherwise the form says why. Card fields only appear for credit
 * cards (CardTermsFields: statement dates by default, numbers by hand as an option; spec 007).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AccountMark } from "@/components/icons/AccountMark";
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
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { kindChangeBlocker, type KindChangeBlocker } from "@/domain/account-kind";
import { cardTermsOf, latestStatement } from "@/domain/card-terms";
import { INSTITUTIONS } from "@/domain/institutions";
import { formatCentsAsInput } from "@/domain/parse";
import type { Account, FinanceSnapshot, IsoDate } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { CardTermsFields } from "./CardTermsFields";
import { useCreateAccount, useUpdateAccount } from "./hooks";
import {
  ACCOUNT_KINDS,
  accountFormSchema,
  type AccountFormInput,
  type AccountFormOutput,
} from "./schema";

type SettingsMessageKey = Parameters<ReturnType<typeof useTranslations<"settings">>>[0];

const BLOCKER_MESSAGES = {
  cardHistory: "kindBlockedCardHistory",
  moneyHistory: "kindBlockedMoneyHistory",
  investmentRules: "kindBlockedInvestmentRules",
} as const satisfies Record<KindChangeBlocker, SettingsMessageKey>;

/** Only what decides whether the kind can change (domain/account-kind.ts). */
const selectKindDeps = (s: FinanceSnapshot) => ({
  statementMarks: s.statementMarks,
  receivables: s.receivables,
  incomes: s.incomes,
  allocations: s.allocations,
  rules: s.rules,
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  /** Names already in use (the database keeps them unique per user). */
  takenNames: readonly string[];
}

/** Edit: the card's latest statement (FR-005), so saving unchanged keeps the same terms. */
function defaultValues(account: Account | null | undefined, today: IsoDate): AccountFormInput {
  if (!account) {
    return {
      kind: "checking",
      name: "",
      institution: "",
      termsMode: "statement",
      statementCutOffOn: "",
      statementDueOn: "",
      cutOffDay: "",
      paymentDueOffsetDays: "20",
      openingBalance: "",
    };
  }
  const terms = cardTermsOf(account);
  const latest = terms ? latestStatement(terms, today) : null;
  return {
    kind: account.kind,
    name: account.name,
    institution: account.institution ?? "",
    termsMode: "statement",
    statementCutOffOn: latest?.cutOffOn ?? "",
    statementDueOn: latest?.dueOn ?? "",
    cutOffDay: account.cutOffDay === null ? "" : String(account.cutOffDay),
    paymentDueOffsetDays:
      account.paymentDueOffsetDays === null ? "" : String(account.paymentDueOffsetDays),
    openingBalance: formatCentsAsInput(account.openingBalance),
  };
}

export function AccountForm({ open, onOpenChange, account, takenNames }: Props) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const editing = Boolean(account);
  const { data: kindDeps } = useFinanceSnapshot(selectKindDeps);
  const today = useToday();

  const form = useForm<AccountFormInput, unknown, AccountFormOutput>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: defaultValues(account, today),
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const accountName = useWatch({ control: form.control, name: "name" });
  const institution = useWatch({ control: form.control, name: "institution" });
  const errors = form.formState.errors;
  const blocker = account && kindDeps ? kindChangeBlocker(account, kind, kindDeps) : null;
  const errorText = (key: string | undefined) => (key ? t(key as SettingsMessageKey) : null);

  function onSubmit(values: AccountFormOutput) {
    if (blocker) return;
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
      // The kind can change unless recorded history depends on it (blocker above); leaving
      // credit_card clears the card terms (the schema returns null for them).
      const patch = {
        kind: values.kind,
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
            <Field data-invalid={Boolean(blocker)}>
              <FieldLabel htmlFor="account-kind">{t("accountKind")}</FieldLabel>
              <NativeSelect
                id="account-kind"
                aria-invalid={Boolean(blocker)}
                {...form.register("kind")}
              >
                {ACCOUNT_KINDS.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {blocker ? (
                <FieldError data-testid="account-kind-blocked">
                  {t(BLOCKER_MESSAGES[blocker])}
                </FieldError>
              ) : (
                editing && <FieldDescription>{t("kindFixed")}</FieldDescription>
              )}
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
              {/* Suggest the known banks so the account gets its logo (domain/institutions.ts). */}
              <div className="flex items-center gap-2">
                <Input
                  id="account-institution"
                  maxLength={60}
                  list="account-institution-options"
                  autoComplete="off"
                  {...form.register("institution")}
                />
                <AccountMark
                  account={{ kind, name: accountName, institution: institution || null }}
                  className="size-8"
                />
              </div>
              <datalist id="account-institution-options">
                {INSTITUTIONS.map((i) => (
                  <option key={i.slug} value={i.name} />
                ))}
              </datalist>
              {errors.institution && (
                <FieldError>{errorText(errors.institution.message)}</FieldError>
              )}
            </Field>

            {kind === "credit_card" && <CardTermsFields form={form} today={today} />}

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
          <Button
            type="submit"
            form="account-form"
            disabled={Boolean(blocker)}
            data-testid="save-account"
          >
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
