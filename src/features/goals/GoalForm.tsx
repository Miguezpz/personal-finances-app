"use client";

/**
 * Create / edit a goal (T145, FR-030). The kind is fixed once created. Changing the source bucket
 * or the monthly amount only affects future contributions (past ones are snapshots).
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
        }
      : {
          kind: "sinking_fund",
          name: "",
          sourceBucket: DEFAULT_SOURCE_BUCKET.sinking_fund,
          targetMonths: "6",
          annual: "",
          monthly: "",
        },
  });
  const [kind, annualText] = useWatch({ control: form.control, name: ["kind", "annual"] });
  const annual = parseMoneyInput(annualText);
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
      };
      update.mutate({ id: goal.id, patch }, callbacks);
    } else {
      create.mutate({ ...values, archived: false }, callbacks);
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

            {kind === "emergency_fund" ? (
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
                placeholder={
                  kind === "sinking_fund" && annual !== null && annual > 0
                    ? formatCentsAsInput(suggestedMonthly(annual))
                    : undefined
                }
                {...form.register("monthly")}
              />
              {errors.monthly ? (
                <FieldError>{errorText(errors.monthly.message)}</FieldError>
              ) : (
                <FieldDescription>{t(`monthlyHints.${kind}`)}</FieldDescription>
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
