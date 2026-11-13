"use client";

/**
 * Assign Saved to a goal or return it (spec 014, FR-003/004/010). One dialog for both: from the
 * Saved card it asks for the goal; from a goal it comes chosen. `max` is what's available to
 * assign (floored at $0) or the goal's net from Saved. Amounts are typed in MXN like everywhere.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
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
import { isNotifiedGlobally } from "@/data/errors";
import type { Cents, Goal, Uuid } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { useAddSavedMove } from "./hooks";
import { makeSavedMoveSchema, type SavedMoveFormInput, type SavedMoveFormOutput } from "./schemas";

type GoalsMessageKey = Parameters<ReturnType<typeof useTranslations<"goals">>>[0];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "assign" | "return";
  /** The goal, or null to pick one of `goals`. */
  goal: Goal | null;
  goals?: readonly Goal[];
  max: Cents;
}

export function SavedMoveDialog({ open, onOpenChange, mode, goal, goals = [], max }: Props) {
  const t = useTranslations("goals");
  const tc = useTranslations("common");
  const today = useToday();
  const add = useAddSavedMove();
  const schema = useMemo(() => makeSavedMoveSchema(max), [max]);
  const form = useForm<SavedMoveFormInput, unknown, SavedMoveFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { goalId: goal?.id ?? goals[0]?.id ?? "", amount: "" },
  });
  const errors = form.formState.errors;
  const assign = mode === "assign";

  function onSubmit(values: SavedMoveFormOutput) {
    add.mutate(
      {
        goalId: values.goalId as Uuid,
        movedOn: today,
        amount: (assign ? values.amount : -values.amount) as Cents,
      },
      {
        onSuccess: () => toast.success(assign ? t("assigned") : t("returned")),
        onError: (e) => {
          if (!isNotifiedGlobally(e)) toast.error(t("saveFailed"));
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
            {assign ? t("assignTitle") : t("returnTitle")}
            {goal && ` · ${goal.name}`}
          </DialogTitle>
          <DialogDescription>{assign ? t("assignHint") : t("returnHint")}</DialogDescription>
        </DialogHeader>

        <form
          id="saved-move-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            {!goal && (
              <Field data-invalid={Boolean(errors.goalId)}>
                <FieldLabel htmlFor="saved-move-goal">{t("goal")}</FieldLabel>
                <NativeSelect
                  id="saved-move-goal"
                  data-testid="saved-move-goal"
                  {...form.register("goalId")}
                >
                  {goals.map((g) => (
                    <NativeSelectOption key={g.id} value={g.id}>
                      {g.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.goalId?.message && (
                  <FieldError>{t(errors.goalId.message as GoalsMessageKey)}</FieldError>
                )}
              </Field>
            )}

            <Field data-invalid={Boolean(errors.amount)}>
              <FieldLabel htmlFor="saved-move-amount">{t("amount")}</FieldLabel>
              <Input
                id="saved-move-amount"
                data-testid="saved-move-amount"
                data-money
                inputMode="decimal"
                autoComplete="off"
                className="tabular-nums"
                {...form.register("amount")}
              />
              {errors.amount?.message ? (
                <FieldError>
                  {errors.amount.message === "overMax"
                    ? t.rich("overMax", { max: () => <Money cents={max} /> })
                    : t(errors.amount.message as GoalsMessageKey)}
                </FieldError>
              ) : (
                <FieldDescription>
                  {t.rich(assign ? "maxAvailable" : "maxReturnable", {
                    max: () => <Money cents={max} />,
                  })}
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="saved-move-form" data-testid="saved-move-save">
            {assign ? t("assign") : t("returnToSaved")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
