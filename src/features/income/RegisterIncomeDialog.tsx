"use client";

/**
 * Register / edit an income (T064, US1).
 *  - Funded quincena suggested by fundedPeriodFor(receivedOn, paydays): the one whose expected
 *    payday is closest, so a late or early (Friday) payment still suggests the right one; editable
 *    (spec 006, research.md R7). Options show each quincena's effective range.
 *  - Recurring incomes are split by the rule in effect on the received date; one-off incomes let
 *    the user choose to split, add it whole to one bucket (spec 015) or not split it (US1-7).
 *    Without a rule: configure one, add it to one bucket or record unsplit.
 *  - Editing recalculates with the income's ORIGINAL rule (rule_id snapshot, FR-005). An income
 *    distributed without a rule was added to one bucket: editing keeps that mode, never re-splits.
 *  - Live preview of the split, computed by the same pure function that is saved.
 *  - Income type (spec 004): mandatory, nothing preselected when registering. Choosing a type while
 *    the label is empty (or still holds the previous suggestion) fills in the type's name.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { rememberLastUsed, useLastUsedDefaults } from "@/features/shared/last-used";
import { notifySaveFailed } from "@/features/shared/retry-toast";
import { useUi } from "@/store/ui";
import { Money } from "@/components/money/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { isIsoDate } from "@/domain/dates";
import { isIncomeType } from "@/domain/income-types";
import { formatCentsAsInput, parseMoneyInput } from "@/domain/parse";
import { fundedPeriodFor, type PayCalendar, withRange } from "@/domain/pay-calendar";
import { nextPeriod, previousPeriod, periodOf } from "@/domain/periods";
import {
  effectiveRule,
  singleBucketAllocation,
  splitIncome,
  type SplitResult,
} from "@/domain/splitter";
import type {
  Account,
  Bucket,
  DistributionRule,
  FinanceSnapshot,
  Income,
  IncomeAllocation,
  IsoDate,
  Uuid,
} from "@/domain/types";
import { usePayCalendar } from "@/lib/use-pay-calendar";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { formatPeriodRange } from "./format";
import { useRegisterIncome, useReplaceIncome } from "./hooks";
import { IncomeTypeField } from "./IncomeTypeField";
import {
  incomeFormSchema,
  type IncomeAllocationMode,
  type IncomeFormInput,
  type IncomeFormOutput,
} from "./schemas";

type IncomeMessageKey = Parameters<ReturnType<typeof useTranslations<"income">>>[0];

const BUCKETS: readonly Bucket[] = ["needs", "wants", "investment"];

const selectFormData = (s: FinanceSnapshot) => ({
  rules: s.rules,
  depositAccounts: s.accounts.filter((a) => a.kind !== "credit_card" && !a.archived),
  allAccounts: s.accounts,
  allocations: s.allocations,
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  income?: Income | null;
  /** What was typed when a save failed ("Retry", spec 009). */
  draft?: Partial<IncomeFormInput>;
}

/** How a saved income was recorded: distributed without a rule = added to one bucket (spec 015). */
function allocationOf(income: Income): IncomeAllocationMode {
  if (!income.distributed) return "none";
  return income.ruleId ? "rules" : "bucket";
}

function defaultsFor(
  income: Income | null | undefined,
  allocations: readonly IncomeAllocation[],
  today: IsoDate,
  paydays: PayCalendar["settings"],
): IncomeFormInput {
  if (income) {
    const allocation = allocationOf(income);
    const single =
      allocation === "bucket" ? allocations.find((a) => a.incomeId === income.id) : undefined;
    return {
      incomeType: income.incomeType,
      label: income.label,
      amount: formatCentsAsInput(income.amount),
      receivedOn: income.receivedOn,
      fundedPeriodStart: income.fundedPeriodStart,
      kind: income.isRecurring ? "recurring" : "oneOff",
      allocation,
      bucket: single?.bucket ?? "wants",
      vehicleId: single?.accountId ?? "",
      depositAccountId: income.depositAccountId ?? "",
    };
  }
  return {
    incomeType: "",
    label: "",
    amount: "",
    receivedOn: today,
    fundedPeriodStart: fundedPeriodFor(today, paydays).start,
    kind: "recurring",
    allocation: "rules",
    bucket: "wants",
    vehicleId: "",
    depositAccountId: "",
  };
}

/** The rule used for a split: the original one when editing a split income, else the effective one. */
function ruleFor(
  rules: readonly DistributionRule[],
  income: Income | null | undefined,
  receivedOn: string,
): DistributionRule | null {
  if (income?.ruleId) return rules.find((r) => r.id === income.ruleId) ?? null;
  return isIsoDate(receivedOn) ? effectiveRule(rules, receivedOn) : null;
}

function safeSplit(
  amountInput: string,
  rule: DistributionRule | null,
  periodStart: string,
): SplitResult | null {
  const amount = parseMoneyInput(amountInput);
  if (!rule || amount === null || amount <= 0 || !isIsoDate(periodStart)) return null;
  try {
    return splitIncome(amount, rule, periodStart);
  } catch {
    return null;
  }
}

function safeBucket(
  amountInput: string,
  bucket: Bucket,
  vehicleId: string,
  periodStart: string,
): SplitResult | null {
  const amount = parseMoneyInput(amountInput);
  if (amount === null || amount <= 0 || !isIsoDate(periodStart)) return null;
  try {
    return singleBucketAllocation(amount, bucket, (vehicleId || null) as Uuid | null, periodStart);
  } catch {
    return null;
  }
}

export function RegisterIncomeDialog({ open, onOpenChange, income, draft }: Props) {
  const t = useTranslations("income");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const calendar = usePayCalendar();
  const { data } = useFinanceSnapshot(selectFormData);
  const register = useRegisterIncome();
  const lastUsed = useLastUsedDefaults();
  const replace = useReplaceIncome();

  const form = useForm<IncomeFormInput, unknown, IncomeFormOutput>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: {
      ...defaultsFor(income, data?.allocations ?? [], today, calendar.settings),
      // Spec 009 (FR-002): the last deposit account for a new income.
      ...(income ? {} : { depositAccountId: lastUsed.depositAccountId }),
      ...draft,
    },
  });
  const [amount, receivedOn, fundedPeriodStart, kind, allocation, bucket, vehicleId] = useWatch({
    control: form.control,
    name: [
      "amount",
      "receivedOn",
      "fundedPeriodStart",
      "kind",
      "allocation",
      "bucket",
      "vehicleId",
    ],
  });

  const rules = data?.rules ?? [];
  const rule = ruleFor(rules, income, receivedOn);
  const preview =
    allocation === "rules"
      ? safeSplit(amount, rule, fundedPeriodStart)
      : allocation === "bucket"
        ? safeBucket(amount, bucket, vehicleId, fundedPeriodStart)
        : null;
  const accountName = (id: string | null) => data?.allAccounts.find((a) => a.id === id)?.name ?? "";
  // Spec 015: active investment accounts; an edited income keeps its own vehicle even if archived.
  const vehicles = (data?.allAccounts ?? []).filter(
    (a) => a.kind === "investment" && (!a.archived || a.id === vehicleId),
  );

  const periodOptions = useMemo(() => {
    if (!isIsoDate(receivedOn)) return [];
    const suggested = fundedPeriodFor(receivedOn, calendar.settings);
    const options = [previousPeriod(suggested), suggested, nextPeriod(suggested)];
    if (isIsoDate(fundedPeriodStart) && !options.some((p) => p.start === fundedPeriodStart)) {
      options.push(periodOf(fundedPeriodStart));
    }
    return options.map((p) => ({
      period: withRange(p, calendar),
      suggested: p.key === suggested.key,
    }));
  }, [receivedOn, fundedPeriodStart, calendar]);

  /** Label filled in by the last type choice; replaced on the next choice, never typed text. */
  const suggestedLabel = useRef<string | null>(null);

  const byRules = allocation === "rules";
  const showSplitChoice = kind === "oneOff" || !rule || !byRules;
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as IncomeMessageKey) : null);

  function onSubmit(values: IncomeFormOutput) {
    const { allocation: mode, bucket: target, vehicleId: vehicle, ...fields } = values;
    if (mode === "rules" && !rule) return; // the alert already explains what to do
    const allocations =
      mode === "rules" && rule
        ? splitIncome(fields.amount, rule, fields.fundedPeriodStart).allocations
        : mode === "bucket"
          ? singleBucketAllocation(fields.amount, target, vehicle, fields.fundedPeriodStart)
              .allocations
          : [];
    const input = {
      income: { ...fields, ruleId: mode === "rules" && rule ? rule.id : null },
      allocations,
    };
    const typed = form.getValues();
    // Promises, not per-call callbacks: the dialog unmounts right after submitting.
    const saved = income
      ? replace.mutateAsync({ id: income.id, input })
      : register.mutateAsync(input);
    saved.then(
      () => {
        toast.success(t("saved"));
        rememberLastUsed({ depositAccountId: values.depositAccountId });
        // Spec 010 (FR-006): the edited income's card highlights.
        if (income) useUi.getState().flash(income.id);
      },
      (e: unknown) =>
        notifySaveFailed(
          e,
          { kind: "income", income: income ?? null, draft: typed },
          { failed: t("saveFailed"), retry: tc("retry") },
        ),
    );
    // Optimistic: the list already shows it; errors roll back and toast.
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{income ? t("editTitle") : t("register")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form
          id="income-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Controller
              name="incomeType"
              control={form.control}
              render={({ field }) => (
                <IncomeTypeField
                  value={isIncomeType(field.value) ? field.value : ""}
                  error={errorText(errors.incomeType?.message)}
                  onChange={(type) => {
                    field.onChange(type);
                    const current = form.getValues("label").trim();
                    if (current === "" || current === suggestedLabel.current) {
                      const name = t(`type.${type}`);
                      suggestedLabel.current = name;
                      form.setValue("label", name, { shouldValidate: form.formState.isSubmitted });
                    }
                  }}
                />
              )}
            />

            <Field data-invalid={Boolean(errors.label)}>
              <FieldLabel htmlFor="income-label">{t("label")}</FieldLabel>
              <Input
                id="income-label"
                maxLength={80}
                placeholder={t("labelPlaceholder")}
                {...form.register("label")}
              />
              {errors.label && <FieldError>{errorText(errors.label.message)}</FieldError>}
            </Field>

            <Field data-invalid={Boolean(errors.amount)}>
              <FieldLabel htmlFor="income-amount">{t("amount")}</FieldLabel>
              <Input
                id="income-amount"
                autoFocus={!income}
                data-money
                inputMode="decimal"
                autoComplete="off"
                placeholder={t("amountPlaceholder")}
                className="tabular-nums"
                {...form.register("amount")}
              />
              {errors.amount && <FieldError>{errorText(errors.amount.message)}</FieldError>}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.receivedOn)}>
                <FieldLabel htmlFor="income-received">{t("receivedOn")}</FieldLabel>
                <Input
                  id="income-received"
                  type="date"
                  {...form.register("receivedOn", {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value;
                      if (isIsoDate(value))
                        form.setValue(
                          "fundedPeriodStart",
                          fundedPeriodFor(value, calendar.settings).start,
                        );
                    },
                  })}
                />
                {errors.receivedOn && (
                  <FieldError>{errorText(errors.receivedOn.message)}</FieldError>
                )}
              </Field>

              <Field data-invalid={Boolean(errors.fundedPeriodStart)}>
                <FieldLabel htmlFor="income-period">{t("fundedPeriod")}</FieldLabel>
                {/* Controlled: the options change with the date, and an uncontrolled select set
                    before they re-render keeps showing the old option. */}
                <NativeSelect
                  id="income-period"
                  {...form.register("fundedPeriodStart")}
                  value={fundedPeriodStart}
                >
                  {periodOptions.map((p) => {
                    const range = formatPeriodRange(p.period, locale);
                    return (
                      <NativeSelectOption key={p.period.start} value={p.period.start}>
                        {t("periodRange", range)}
                        {p.suggested ? ` (${t("suggested")})` : ""}
                      </NativeSelectOption>
                    );
                  })}
                </NativeSelect>
                {errors.fundedPeriodStart && (
                  <FieldError>{errorText(errors.fundedPeriodStart.message)}</FieldError>
                )}
              </Field>
            </div>

            <Controller
              name="kind"
              control={form.control}
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">{t("kind")}</FieldLegend>
                  <RadioGroup
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      if (v === "recurring") form.setValue("allocation", "rules");
                    }}
                    className="flex flex-wrap gap-4"
                  >
                    {(["recurring", "oneOff"] as const).map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <RadioGroupItem id={`income-kind-${k}`} value={k} />
                        <Label htmlFor={`income-kind-${k}`}>
                          {t(k === "recurring" ? "kindRecurring" : "kindOneOff")}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FieldSet>
              )}
            />

            {showSplitChoice && (
              <Controller
                name="allocation"
                control={form.control}
                render={({ field }) => (
                  <FieldSet>
                    <FieldLegend variant="label">{t("splitQuestion")}</FieldLegend>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem id="income-split-yes" value="rules" />
                        <Label htmlFor="income-split-yes">{t("splitByRules")}</Label>
                      </div>
                      {/* Spec 015: only a one-off income can go whole to one bucket. */}
                      {kind === "oneOff" && (
                        <div className="flex items-center gap-2">
                          <RadioGroupItem id="income-split-bucket" value="bucket" />
                          <Label htmlFor="income-split-bucket">{t("splitToBucket")}</Label>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <RadioGroupItem id="income-split-no" value="none" />
                        <Label htmlFor="income-split-no">{t("recordWithoutSplit")}</Label>
                      </div>
                    </RadioGroup>
                  </FieldSet>
                )}
              />
            )}

            {allocation === "bucket" && (
              <Controller
                name="bucket"
                control={form.control}
                render={({ field }) => (
                  <FieldSet>
                    <FieldLegend variant="label">{t("bucketQuestion")}</FieldLegend>
                    <RadioGroup
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        if (v === "investment" && !vehicleId && vehicles[0]) {
                          form.setValue("vehicleId", vehicles[0].id);
                        }
                      }}
                      className="flex flex-wrap gap-4"
                    >
                      {BUCKETS.map((b) => (
                        <div key={b} className="flex items-center gap-2">
                          <RadioGroupItem
                            id={`income-bucket-${b}`}
                            value={b}
                            disabled={b === "investment" && vehicles.length === 0}
                          />
                          <Label htmlFor={`income-bucket-${b}`}>{tb(b)}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {vehicles.length === 0 && (
                      <p className="text-sm text-muted-foreground">{t("noVehicles")}</p>
                    )}
                  </FieldSet>
                )}
              />
            )}

            {allocation === "bucket" && bucket === "investment" && (
              <Field data-invalid={Boolean(errors.vehicleId)}>
                <FieldLabel htmlFor="income-vehicle">{t("vehicle")}</FieldLabel>
                <NativeSelect
                  id="income-vehicle"
                  data-testid="income-vehicle"
                  {...form.register("vehicleId")}
                >
                  <NativeSelectOption value="">{t("noAccount")}</NativeSelectOption>
                  {vehicles.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p className="text-sm text-muted-foreground">{t("investmentNote")}</p>
                {errors.vehicleId && <FieldError>{errorText(errors.vehicleId.message)}</FieldError>}
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="income-account">{t("depositAccount")}</FieldLabel>
              <NativeSelect id="income-account" {...form.register("depositAccountId")}>
                <NativeSelectOption value="">{t("noAccount")}</NativeSelectOption>
                {(data?.depositAccounts ?? []).map((a: Account) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>

          {byRules && !rule && (
            <Alert>
              <AlertTitle>{t("noRuleTitle")}</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {t("noRuleHint")}
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/settings/rules">{t("configureRules")}</Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => form.setValue("allocation", "none")}
                  >
                    {t("recordWithoutSplit")}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {((byRules && rule) || allocation === "bucket") && (
            <section aria-labelledby="income-preview" className="rounded-lg border p-3">
              <h3 id="income-preview" className="mb-2 text-sm font-medium">
                {t("preview")}
              </h3>
              {preview ? (
                <ul className="flex flex-col gap-1 text-sm" data-testid="split-preview">
                  {preview.allocations.map((a) => (
                    <li
                      key={`${a.bucket}-${a.accountId ?? ""}`}
                      className="flex justify-between gap-4"
                    >
                      <span>
                        {tb(a.bucket)}
                        {a.accountId && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {accountName(a.accountId)}
                          </span>
                        )}
                      </span>
                      <Money cents={a.amount} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("previewInvalid")}</p>
              )}
            </section>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            form="income-form"
            data-testid="save-income"
            disabled={byRules && !rule}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
