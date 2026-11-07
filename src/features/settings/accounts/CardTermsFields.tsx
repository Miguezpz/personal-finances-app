"use client";

/**
 * Card terms inside AccountForm (spec 007, contracts/ui-components.md). By default the owner types
 * the cut-off and due dates of one statement; the day and the days to pay are derived, with the
 * next 3 statements (due dates already moved to business days) and non-blocking warnings. The
 * numbers can still be typed by hand; the preview follows either mode.
 */
import { CalendarClock, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  cardTermsFromStatement,
  latestStatement,
  nominalDueDate,
  statementWarnings,
  upcomingStatements,
  type CardTerms,
  type StatementError,
  type StatementWarning,
} from "@/domain/card-terms";
import { isIsoDate } from "@/domain/dates";
import type { IsoDate } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { selectLocale, usePreferences } from "@/store/preferences";
import type { AccountFormInput, AccountFormOutput } from "./schema";

type SettingsMessageKey = Parameters<ReturnType<typeof useTranslations<"settings">>>[0];

const dayIn = (min: number, max: number, value: string | undefined) => {
  const n = value && /^\d{1,2}$/.test(value.trim()) ? Number(value) : Number.NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

interface Derived {
  terms: CardTerms | null;
  error: StatementError | null;
  warnings: StatementWarning[];
}

function derive(
  mode: AccountFormInput["termsMode"],
  cutOffOn: string | undefined,
  dueOn: string | undefined,
  cutOffDay: string | undefined,
  offset: string | undefined,
): Derived {
  if (mode === "manual") {
    const day = dayIn(1, 31, cutOffDay);
    const days = dayIn(1, 60, offset);
    return {
      terms: day !== null && days !== null ? { cutOffDay: day, paymentDueOffsetDays: days } : null,
      error: null,
      warnings: [],
    };
  }
  if (!isIsoDate(cutOffOn) || !isIsoDate(dueOn)) return { terms: null, error: null, warnings: [] };
  const r = cardTermsFromStatement(cutOffOn, dueOn);
  return r.ok
    ? { terms: r.terms, error: null, warnings: statementWarnings(cutOffOn, dueOn) }
    : { terms: null, error: r.error, warnings: [] };
}

interface Props {
  form: UseFormReturn<AccountFormInput, unknown, AccountFormOutput>;
  today: IsoDate;
}

export function CardTermsFields({ form, today }: Props) {
  const t = useTranslations("settings");
  const locale = usePreferences(selectLocale);
  const [mode, cutOffOn, dueOn, cutOffDay, offset] = useWatch({
    control: form.control,
    name: ["termsMode", "statementCutOffOn", "statementDueOn", "cutOffDay", "paymentDueOffsetDays"],
  });
  const errors = form.formState.errors;
  const { terms, error, warnings } = derive(mode, cutOffOn, dueOn, cutOffDay, offset);
  const statements = terms ? upcomingStatements(terms, today, 3) : [];
  const errorText = (key: string | undefined) => (key ? t(key as SettingsMessageKey) : null);
  const dueError = errorText(error ?? errors.statementDueOn?.message);

  function switchTo(next: "statement" | "manual") {
    // Carry what is already known into the other mode.
    if (terms && next === "manual") {
      form.setValue("cutOffDay", String(terms.cutOffDay));
      form.setValue("paymentDueOffsetDays", String(terms.paymentDueOffsetDays));
    }
    if (terms && next === "statement") {
      const latest = latestStatement(terms, today);
      form.setValue("statementCutOffOn", latest.cutOffOn);
      form.setValue("statementDueOn", latest.dueOn);
    }
    form.clearErrors();
    form.setValue("termsMode", next);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="card-terms-fields">
      {mode === "manual" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={Boolean(errors.cutOffDay)}>
            <FieldLabel htmlFor="account-cutoff">{t("cutOffDay")}</FieldLabel>
            <Input
              id="account-cutoff"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("cutOffDay")}
            />
            {errors.cutOffDay && <FieldError>{errorText(errors.cutOffDay.message)}</FieldError>}
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
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.statementCutOffOn)}>
            <FieldLabel htmlFor="card-statement-cutoff">{t("statementCutOff")}</FieldLabel>
            <Input
              id="card-statement-cutoff"
              type="date"
              autoComplete="off"
              {...form.register("statementCutOffOn")}
            />
            {errors.statementCutOffOn && (
              <FieldError>{errorText(errors.statementCutOffOn.message)}</FieldError>
            )}
          </Field>
          <Field data-invalid={Boolean(dueError)}>
            <FieldLabel htmlFor="card-statement-due">{t("statementDue")}</FieldLabel>
            <Input
              id="card-statement-due"
              type="date"
              autoComplete="off"
              aria-invalid={Boolean(dueError)}
              {...form.register("statementDueOn")}
            />
            {dueError && <FieldError data-testid="card-statement-error">{dueError}</FieldError>}
          </Field>
          <FieldDescription className="sm:col-span-2">{t("statementHint")}</FieldDescription>
        </div>
      )}

      <div aria-live="polite" data-testid="card-terms-summary" className="flex flex-col gap-2">
        {terms && (
          <>
            <p className="text-sm font-medium">
              {t("cardTerms", { day: terms.cutOffDay, offset: terms.paymentDueOffsetDays })}
            </p>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{t("upcomingStatements")}</p>
              <ul data-testid="card-upcoming-statements" className="flex flex-col gap-1 text-sm">
                {statements.map((s) => {
                  const moved = s.dueOn !== nominalDueDate(terms, s.cutOffOn);
                  return (
                    <li
                      key={s.cutOffOn}
                      className="flex flex-wrap items-center gap-x-2 tabular-nums"
                    >
                      <span>
                        {t("statementRow", {
                          cutOff: formatDate(s.cutOffOn, locale),
                          due: formatDate(s.dueOn, locale),
                        })}
                      </span>
                      {moved && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock aria-hidden className="size-3.5" />
                          {t("movedForHoliday")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
        {warnings.length > 0 && (
          <Alert data-testid="card-statement-warnings">
            <TriangleAlert aria-hidden />
            <AlertDescription>
              {warnings.map((w) => (
                <p key={w}>{t(w)}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Button
        type="button"
        variant="link"
        className="h-auto self-start p-0"
        data-testid="card-terms-mode"
        onClick={() => switchTo(mode === "manual" ? "statement" : "manual")}
      >
        {mode === "manual" ? t("useStatementDates") : t("enterNumbers")}
      </Button>
    </div>
  );
}
