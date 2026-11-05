"use client";

/**
 * Icon picker of the taxonomy editor (spec 004, FR-012, contracts/ui-components.md).
 *
 * The trigger shows the icon in use and is named "Change icon of <name>". The dialog lists the
 * curated set as a radio group (arrow keys move, Space/Enter select — Radix roving focus); the
 * choice is applied with Save, so moving through the grid with the keyboard never writes.
 * Subcategories get a first option "Use the category icon" that clears their own icon (null).
 * In the demo the save is a write like any other: the provider rejects it and the read-only toast
 * is shown by the global mutation handler.
 */
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useState } from "react";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
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
  CATEGORY_ICON_KEYS,
  type CategoryIconKey,
  type ResolvedTaxonomyIcon,
} from "@/domain/icons";
import { cn } from "@/lib/utils";
import { taxonomyIconSchema } from "./schema";

const INHERIT = "__inherit__";

interface Props {
  /** Name shown in the accessible labels (already translated). */
  itemName: string;
  /** The item's own icon (null = none). */
  value: CategoryIconKey | null;
  /** Icon shown on the trigger (the resolved one: own → category → generic). */
  shown: ResolvedTaxonomyIcon;
  /** Only for subcategories: the icon they inherit when `value` is null. */
  inherited?: ResolvedTaxonomyIcon;
  onChange: (next: CategoryIconKey | null) => void;
}

const option = cn(
  "flex size-11 items-center justify-center rounded-lg border outline-none",
  "hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary/10",
);

export function IconPicker({ itemName, value, shown, inherited, onChange }: Props) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value ?? (inherited ? INHERIT : ""));
  const iconName = (key: CategoryIconKey) => t(`iconNames.${key}`);

  function openPicker() {
    setDraft(value ?? (inherited ? INHERIT : ""));
    setOpen(true);
  }

  function save() {
    const parsed = taxonomyIconSchema.safeParse(draft === INHERIT ? null : draft);
    if (!parsed.success) return;
    if (parsed.data !== value) onChange(parsed.data);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("iconPicker", { name: itemName })}
        data-testid="icon-picker"
        data-icon={shown}
        onClick={openPicker}
      >
        <CategoryIcon icon={shown} className="text-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("iconPicker", { name: itemName })}</DialogTitle>
            <DialogDescription>{t("iconPickerHint")}</DialogDescription>
          </DialogHeader>
          {inherited && (
            <RadioGroupPrimitive.Root
              value={draft === INHERIT ? INHERIT : ""}
              onValueChange={setDraft}
              aria-label={t("iconInherited")}
            >
              <RadioGroupPrimitive.Item
                value={INHERIT}
                data-testid="icon-option-inherit"
                className={cn(option, "w-full justify-start gap-2 px-3 text-sm")}
              >
                <CategoryIcon icon={inherited} />
                <span>{t("iconInherited")}</span>
                {draft === INHERIT && <Check aria-hidden="true" className="ml-auto size-4" />}
              </RadioGroupPrimitive.Item>
            </RadioGroupPrimitive.Root>
          )}
          <RadioGroupPrimitive.Root
            value={draft === INHERIT ? "" : draft}
            onValueChange={setDraft}
            aria-label={t("icon")}
            className="grid grid-cols-6 gap-2 sm:grid-cols-8"
            data-testid="icon-grid"
          >
            {CATEGORY_ICON_KEYS.map((key) => (
              <RadioGroupPrimitive.Item
                key={key}
                value={key}
                aria-label={iconName(key)}
                title={iconName(key)}
                data-testid={`icon-option-${key}`}
                className={option}
              >
                <CategoryIcon icon={key} className="text-foreground" />
              </RadioGroupPrimitive.Item>
            ))}
          </RadioGroupPrimitive.Root>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("iconCancel")}
            </Button>
            <Button type="button" onClick={save} disabled={draft === ""} data-testid="save-icon">
              {t("iconSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
