"use client";

/**
 * Income type picker (spec 004, FR-008, contracts/ui-components.md): the 9 fixed types as a radio
 * group in a grid, each with its icon and translated name. No option is selected when registering
 * (Clarification B); the error is announced (FieldError has role="alert") and tied to the group
 * with aria-describedby. Native selects can't show icons, so this reuses the existing RadioGroup.
 */
import { useTranslations } from "next-intl";
import { INCOME_TYPE_ICONS } from "@/components/icons/income-type-icons";
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { RadioGroup } from "@/components/ui/radio-group";
import { INCOME_TYPES, type IncomeType } from "@/domain/income-types";
import { cn } from "@/lib/utils";

interface Props {
  value: IncomeType | "";
  onChange: (type: IncomeType) => void;
  /** Already translated error message. */
  error?: string | null;
}

const ERROR_ID = "income-type-error";

export function IncomeTypeField({ value, onChange, error }: Props) {
  const t = useTranslations("income");
  return (
    <FieldSet data-invalid={Boolean(error)}>
      <FieldLegend variant="label">{t("typeLabel")}</FieldLegend>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as IncomeType)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? ERROR_ID : undefined}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        data-testid="income-type"
      >
        {INCOME_TYPES.map((type) => {
          const Icon = INCOME_TYPE_ICONS[type];
          return (
            <RadioGroupPrimitive.Item
              key={type}
              value={type}
              data-testid={`income-type-${type}`}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "hover:bg-accent data-[state=checked]:border-primary data-[state=checked]:bg-primary/10 data-[state=checked]:font-medium",
                "aria-invalid:border-destructive",
              )}
            >
              <Icon
                aria-hidden="true"
                focusable="false"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span>{t(`type.${type}`)}</span>
            </RadioGroupPrimitive.Item>
          );
        })}
      </RadioGroup>
      {error && <FieldError id={ERROR_ID}>{error}</FieldError>}
    </FieldSet>
  );
}
