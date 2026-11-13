"use client";

/**
 * Create / edit a goal (T145, FR-030). The kind is fixed once created. Changing the source bucket
 * or the monthly amount only affects future contributions (past ones are snapshots).
 * Spec 014: a purchase has a target and an optional month; no source bucket or monthly amount,
 * and editing it never touches what was assigned from Saved.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { useEffect, useRef } from "react";
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
import { isNotifiedGlobally } from "@/data/errors";
import { suggestedMonthly } from "@/domain/goals";
import { formatCentsAsInput, parseMoneyInput } from "@/domain/parse";
import type { Goal, GoalKind } from "@/domain/types";
import { useCreateGoal, useUpdateGoal } from "./hooks";
import {
  DEFAULT_SOURCE_BUCKET,
  GOAL_BUCKETS,
  GOAL_KINDS,
  goalFormSchema,
  type GoalFormInput,
  type GoalFormOutput,
} from "./schemas";

type GoalsMessageKey = Parameters<ReturnType<typeof useTranslations<"goals">>>[0];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
}

export function GoalForm({ open, onOpenChange, goal }: Props) {
  const t = useTranslations("goals");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const editing = Boolean(goal);

  const form = useForm<GoalFormInput, unknown, GoalFormOutput>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goal
      ? {
          kind: goal.kind,
          name: goal.name,
          sourceBucket: goal.sourceBucket,
          targetMonths: goal.targetMonths === null ? "" : String(goal.targetMonths),
          annual: goal.annual === null ? "" : formatCentsAsInput(goal.annual),
          monthly: goal.monthly === null ? "" : formatCentsAsInput(goal.monthly),
          target: goal.target === null ? "" : formatCentsAsInput(goal.target),
          targetMonth: goal.targetMonth?.slice(0, 7) ?? "",
        }
      : {
          kind: "sinking_fund",
          name: "",
          sourceBucket: DEFAULT_SOURCE_BUCKET.sinking_fund,
          targetMonths: "6",
          annual: "",
          monthly: "",
          target: "",
          targetMonth: "",
        },
  });
  const [kind, annualText] = useWatch({ control: form.control, name: ["kind", "annual"] });
  const annual = parseMoneyInput(annualText);
  // Spec 009 (FR-028): the suggested monthly hold-back becomes the field's value while the owner
  // hasn't typed one, so it's saved as shown.
  const autoMonthly = useRef<string | null>(null);
  useEffect(() => {
    if (kind !== "sinking_fund" || annual === null || annual <= 0) return;
    const current = form.getValues("monthly");
    // Only an empty field or our own previous suggestion: never what the owner typed or saved.
    if (current && current !== autoMonthly.current) return;
    const suggestion = formatCentsAsInput(suggestedMonthly(annual));
    autoMonthly.current = suggestion;
    form.setValue("monthly", suggestion, { shouldValidate: true });
  }, [kind, annual, form]);
  const errors = form.formState.errors;
  const errorText = (key: string | undefined) => (key ? t(key as GoalsMessageKey) : null);

  function onKindChange(next: GoalKind) {
    form.setValue("kind", next);
    // Follow the default source of the new kind unless the user already picked another one.
    if (form.getValues("sourceBucket") === DEFAULT_SOURCE_BUCKET[kind]) {
      form.setValue("sourceBucket", DEFAULT_SOURCE_BUCKET[next]);
    }
  }

  function onSubmit(values: GoalFormOutput) {
    const callbacks = {
      onSuccess: () => toast.success(t("saved")),
      onError: (e: Error) => {
        if (!isNotifiedGlobally(e)) toast.error(t("saveFailed"));
      },
    };
    if (goal) {
      // The kind is fixed once created.
      const patch = {
        name: values.name,
        sourceBucket: values.sourceBucket,
        targetMonths: values.targetMonths,
        annual: values.annual,
        monthly: values.monthly,
        target: values.target,
        targetMonth: values.targetMonth,
      };
      update.mutate({ id: goal.id, patch }, callbacks);
    } else {
      create.mutate({ ...values, archived: false, completed: false }, callbacks);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("formHint")}</DialogDescription>
        </DialogHeader>

        <form
          id="goal-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="goal-kind">{t("kind")}</FieldLabel>
              <NativeSelect
                id="goal-kind"
                disabled={editing}
                value={kind}
                onChange={(e) => onKindChange(e.target.value as GoalKind)}
              >
                {GOAL_KINDS.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>{t(`kindHints.${kind}`)}</FieldDescription>
            </Field>

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="goal-name">{t("name")}</FieldLabel>
              <Input
                id="goal-name"
                maxLength={80}
                placeholder={t(`namePlaceholders.${kind}`)}
                {...form.register("name")}
              />
              {errors.name && <FieldError>{errorText(errors.name.message)}</FieldError>}
            </Field>

            {kind === "purchase" ? (
              <>
                <Field data-invalid={Boolean(errors.target)}>
                  <FieldLabel htmlFor="goal-target">{t("targetAmount")}</FieldLabel>
                  <Input
                    id="goal-target"
                    data-money
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                    {...form.register("target")}
                  />
                  {errors.target && <FieldError>{errorText(errors.target.message)}</FieldError>}
                </Field>
                <Field data-invalid={Boolean(errors.targetMonth)}>
                  <FieldLabel htmlFor="goal-target-month">{t("targetMonth")}</FieldLabel>
                  {/* Without a month picker (Safari, Firefox) it's a text field; the schema checks YYYY-MM. */}
                  <Input
                    id="goal-target-month"
                    type="month"
                    placeholder="YYYY-MM"
                    className="w-44"
                    {...form.register("targetMonth")}
                  />
                  {errors.targetMonth ? (
                    <FieldError>{errorText(errors.targetMonth.message)}</FieldError>
                  ) : (
                    <FieldDescription>{t("targetMonthHint")}</FieldDescription>
                  )}
                </Field>
              </>
            ) : kind === "emergency_fund" ? (
              <Field data-invalid={Boolean(errors.targetMonths)}>
                <FieldLabel htmlFor="goal-months">{t("targetMonths")}</FieldLabel>
                <Input
                  id="goal-months"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-24"
                  {...form.register("targetMonths")}
                />
                {errors.targetMonths ? (
                  <FieldError>{errorText(errors.targetMonths.message)}</FieldError>
                ) : (
                  <FieldDescription>{t("targetMonthsHint")}</FieldDescription>
                )}
              </Field>
            ) : (
              <Field data-invalid={Boolean(errors.annual)}>
                <FieldLabel htmlFor="goal-annual">{t("annual")}</FieldLabel>
                <Input
                  id="goal-annual"
                  data-money
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  {...form.register("annual")}
                />
                {errors.annual && <FieldError>{errorText(errors.annual.message)}</FieldError>}
              </Field>
            )}

            {kind !== "purchase" && (
              <>
                <Field data-invalid={Boolean(errors.monthly)}>
                  <FieldLabel htmlFor="goal-monthly">
                    {kind === "emergency_fund" ? t("monthlyOptional") : t("monthly")}
                  </FieldLabel>
                  <Input
                    id="goal-monthly"
                    data-money
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                    {...form.register("monthly")}
                  />
                  {errors.monthly ? (
                    <FieldError>{errorText(errors.monthly.message)}</FieldError>
                  ) : (
                    <FieldDescription>
                      {t(`monthlyHints.${kind as "emergency_fund" | "sinking_fund"}`)}
                    </FieldDescription>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="goal-source">{t("sourceBucket")}</FieldLabel>
                  <NativeSelect id="goal-source" {...form.register("sourceBucket")}>
                    {GOAL_BUCKETS.map((b) => (
                      <NativeSelectOption key={b} value={b}>
                        {tb(b)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>{t("sourceBucketHint")}</FieldDescription>
                </Field>
              </>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="goal-form" data-testid="save-goal">
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
