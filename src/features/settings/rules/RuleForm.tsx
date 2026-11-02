"use client";

/**
 * Distribution rule editor (T063, US1-3, FR-001/002/005).
 * Saving always creates a version effective today (or tomorrow if today's version was already
 * used by an income — that version is a snapshot). Past allocations never change.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isDemoReadOnlyError, isProviderError } from "@/data/errors";
import { BPS_TOTAL } from "@/domain/money";
import { formatBpsAsPercentInput, parsePercentInput } from "@/domain/parse";
import { nextRuleEffectiveDate } from "@/domain/splitter";
import type { Account, BasisPoints, DistributionRule, Income, IsoDate } from "@/domain/types";
import { formatDate, formatPercent } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { selectLocale, usePreferences } from "@/store/preferences";
import { useCreateInvestmentAccount, useSaveRule } from "./hooks";
import { ruleFormSchema, type RuleFormInput, type RuleFormOutput } from "./schema";

type RulesMessageKey = Parameters<ReturnType<typeof useTranslations<"rules">>>[0];

interface RuleFormProps {
  current: DistributionRule | null;
  rules: readonly DistributionRule[];
  incomes: readonly Pick<Income, "ruleId">[];
  vehicles: readonly Account[];
  today: IsoDate;
}

const DEFAULTS: RuleFormInput = { needs: "50", wants: "30", investment: "20", subrules: [] };

function toFormValues(rule: DistributionRule | null): RuleFormInput {
  if (!rule) return DEFAULTS;
  return {
    needs: formatBpsAsPercentInput(rule.needs),
    wants: formatBpsAsPercentInput(rule.wants),
    investment: formatBpsAsPercentInput(rule.investment),
    subrules: rule.investmentSubrules.map((s) => ({
      accountId: s.accountId,
      pct: formatBpsAsPercentInput(s.pct),
    })),
  };
}

/** Live "x% missing / over" status for a set of typed percentages. */
function sumStatus(values: readonly (string | undefined)[]) {
  const parsed = values.map((v) => parsePercentInput(v ?? ""));
  if (parsed.some((p) => p === null)) return null;
  const total = parsed.reduce<number>((s, p) => s + (p as number), 0);
  return {
    total: total as BasisPoints,
    diff: Math.abs(BPS_TOTAL - total) as BasisPoints,
    ok: total === BPS_TOTAL,
    missing: total < BPS_TOTAL,
  };
}

export function RuleForm({ current, rules, incomes, vehicles, today }: RuleFormProps) {
  const t = useTranslations("rules");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const locale = usePreferences(selectLocale);
  const saveRule = useSaveRule();
  const createVehicle = useCreateInvestmentAccount();
  const [newVehicle, setNewVehicle] = useState("");

  const form = useForm<RuleFormInput, unknown, RuleFormOutput>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: toFormValues(current),
  });
  const subrules = useFieldArray({ control: form.control, name: "subrules" });
  const [needs, wants, investment, rows] = useWatch({
    control: form.control,
    name: ["needs", "wants", "investment", "subrules"],
  });
  const total = sumStatus([needs, wants, investment]);
  const subTotal = sumStatus(rows.map((r) => r.pct));
  const investing = parsePercentInput(investment ?? "") !== 0;
  const pct = (v: BasisPoints) => formatPercent(v, locale);
  const errors = form.formState.errors as FieldErrors<RuleFormInput> & {
    total?: { message?: string };
    subrulesTotal?: { message?: string };
  };

  async function addVehicle() {
    const name = newVehicle.trim();
    if (!name) return;
    try {
      const account = await createVehicle.mutateAsync(name);
      subrules.append({ accountId: account.id, pct: subrules.fields.length === 0 ? "100" : "0" });
      setNewVehicle("");
    } catch {
      /* demo / failures surface as toasts */
    }
  }

  function onSubmit(values: RuleFormOutput) {
    const effectiveFrom = nextRuleEffectiveDate(rules, incomes, today);
    saveRule.mutate(
      {
        rule: {
          effectiveFrom,
          needs: values.needs,
          wants: values.wants,
          investment: values.investment,
          investmentSubrules: values.subrules,
        },
      },
      {
        onSuccess: () =>
          toast.success(
            effectiveFrom === today
              ? t("saved", { date: formatDate(effectiveFrom, locale) })
              : t("effectiveTomorrow", { date: formatDate(effectiveFrom, locale) }),
          ),
        onError: (e) => {
          if (isDemoReadOnlyError(e)) return; // global read-only toast
          toast.error(isProviderError(e, "CONFLICT") ? t("conflict") : tc("unexpectedError"));
        },
      },
    );
  }

  const percentField = (name: "needs" | "wants" | "investment") => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={`rule-${name}`}>{tb(name)}</FieldLabel>
      <div className="relative">
        <Input
          id={`rule-${name}`}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={Boolean(errors[name])}
          className="pr-8 tabular-nums"
          {...form.register(name)}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
        >
          %
        </span>
      </div>
      {errors[name]?.message && (
        <FieldError>{t(errors[name].message as RulesMessageKey)}</FieldError>
      )}
    </Field>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend>{t("percentages")}</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-3">
          {percentField("needs")}
          {percentField("wants")}
          {percentField("investment")}
        </FieldGroup>
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "text-sm",
            total && !total.ok ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {total &&
            (total.ok
              ? t("sumOk")
              : t(total.missing ? "sumMissing" : "sumExcess", { diff: pct(total.diff) }))}
          {total && <span className="sr-only"> {t("total", { total: pct(total.total) })}</span>}
        </p>
        {errors.total && !total && <FieldError>{t("invalidPercent")}</FieldError>}
      </FieldSet>

      {investing && (
        <FieldSet>
          <FieldLegend>{t("vehicles")}</FieldLegend>
          <FieldDescription>{t("vehiclesHint")}</FieldDescription>

          {vehicles.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noVehicles")}</p>
          )}

          <ul className="flex flex-col gap-3">
            {subrules.fields.map((row, index) => {
              const rowErrors = errors.subrules?.[index];
              return (
                <li key={row.id} className="grid grid-cols-[1fr_7rem_auto] items-start gap-2">
                  <Field data-invalid={Boolean(rowErrors?.accountId)}>
                    <FieldLabel htmlFor={`subrule-${index}-account`} className="sr-only">
                      {t("vehicle")}
                    </FieldLabel>
                    <NativeSelect
                      id={`subrule-${index}-account`}
                      {...form.register(`subrules.${index}.accountId`)}
                    >
                      <NativeSelectOption value="">{t("chooseVehicle")}</NativeSelectOption>
                      {vehicles.map((v) => (
                        <NativeSelectOption key={v.id} value={v.id}>
                          {v.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {rowErrors?.accountId?.message && (
                      <FieldError>{t(rowErrors.accountId.message as RulesMessageKey)}</FieldError>
                    )}
                  </Field>
                  <Field data-invalid={Boolean(rowErrors?.pct)}>
                    <FieldLabel htmlFor={`subrule-${index}-pct`} className="sr-only">
                      {t("vehiclePercent")}
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id={`subrule-${index}-pct`}
                        inputMode="decimal"
                        autoComplete="off"
                        className="pr-8 tabular-nums"
                        {...form.register(`subrules.${index}.pct`)}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                      >
                        %
                      </span>
                    </div>
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => subrules.remove(index)}
                    aria-label={t("removeVehicle")}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>

          {subrules.fields.length > 0 && subTotal && !subTotal.ok && (
            <p role="status" className="text-sm text-destructive">
              {t(subTotal.missing ? "subrulesSumMissing" : "subrulesSumExcess", {
                diff: pct(subTotal.diff),
              })}
            </p>
          )}
          {errors.subrules?.root?.message && (
            <FieldError>{t(errors.subrules.root.message as RulesMessageKey)}</FieldError>
          )}
          {(errors.subrules as { message?: string } | undefined)?.message && (
            <FieldError>
              {t((errors.subrules as { message: string }).message as RulesMessageKey)}
            </FieldError>
          )}

          <div className="flex flex-wrap gap-2">
            {vehicles.length > subrules.fields.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => subrules.append({ accountId: "", pct: "0" })}
              >
                <Plus aria-hidden="true" />
                {t("addVehicle")}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field className="sm:max-w-xs">
              <FieldLabel htmlFor="new-vehicle">{t("newVehicle")}</FieldLabel>
              <Input
                id="new-vehicle"
                value={newVehicle}
                maxLength={60}
                placeholder={t("newVehiclePlaceholder")}
                onChange={(e) => setNewVehicle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addVehicle();
                  }
                }}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void addVehicle()}
              data-testid="create-vehicle"
              disabled={!newVehicle.trim() || createVehicle.isPending}
            >
              {t("createVehicle")}
            </Button>
          </div>
        </FieldSet>
      )}

      <div>
        <Button type="submit" disabled={saveRule.isPending} data-testid="save-rule">
          {saveRule.isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
