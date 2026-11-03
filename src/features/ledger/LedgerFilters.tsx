"use client";

/** Ledger filters (T125, FR-042): date range, category, account, movement type and third party. */
import { ListFilter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { cn } from "@/lib/utils";
import {
  EMPTY_LEDGER_FILTERS,
  isFiltering,
  LEDGER_TYPES,
  type LedgerFilterState,
  type ThirdPartyFilter,
} from "./filters";
import type { LedgerLookups } from "./hooks";

interface Props {
  value: LedgerFilterState;
  onChange: (next: LedgerFilterState) => void;
  lookups: LedgerLookups;
}

export function LedgerFilters({ value, onChange, lookups }: Props) {
  const t = useTranslations("ledger");
  const tb = useTranslations("buckets");
  const nameOf = useTaxonomyName();
  // On phones the filters fold behind a toggle so the movements stay on the first screen.
  const [open, setOpen] = useState(false);
  const active = (Object.keys(EMPTY_LEDGER_FILTERS) as (keyof LedgerFilterState)[]).filter(
    (k) => value[k] !== EMPTY_LEDGER_FILTERS[k],
  ).length;
  const set = <K extends keyof LedgerFilterState>(key: K, v: LedgerFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const categoriesByMacro = (["needs", "wants"] as const).map((macro) => ({
    macro,
    categories: lookups.categories
      .filter((c) => c.macro === macro)
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
  }));
  const accounts = [...lookups.accounts].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name),
  );

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        className="w-fit md:hidden"
        aria-expanded={open}
        aria-controls="ledger-filters"
        onClick={() => setOpen((o) => !o)}
        data-testid="toggle-ledger-filters"
      >
        <ListFilter aria-hidden="true" />
        {t("showFilters")}
        {active > 0 && (
          <span className="text-muted-foreground">{t("activeFilters", { count: active })}</span>
        )}
      </Button>
      <div
        id="ledger-filters"
        className={cn(
          "gap-4 rounded-lg border p-4 sm:grid-cols-2 md:grid lg:grid-cols-3",
          open ? "grid" : "hidden",
        )}
        role="group"
        aria-label={t("filters")}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field>
            <FieldLabel htmlFor="ledger-from">{t("from")}</FieldLabel>
            <Input
              id="ledger-from"
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => set("from", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ledger-to">{t("to")}</FieldLabel>
            <Input
              id="ledger-to"
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => set("to", e.target.value)}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="ledger-type">{t("type")}</FieldLabel>
          <NativeSelect
            id="ledger-type"
            value={value.type}
            onChange={(e) => set("type", e.target.value as LedgerFilterState["type"])}
          >
            <NativeSelectOption value="">{t("allTypes")}</NativeSelectOption>
            {LEDGER_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {t(`types.${type}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="ledger-category">{t("category")}</FieldLabel>
          <NativeSelect
            id="ledger-category"
            value={value.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            <NativeSelectOption value="">{t("allCategories")}</NativeSelectOption>
            {categoriesByMacro.map(({ macro, categories }) => (
              <NativeSelectOptGroup key={macro} label={tb(macro)}>
                {categories.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {nameOf(c)}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="ledger-account">{t("account")}</FieldLabel>
          <NativeSelect
            id="ledger-account"
            value={value.accountId}
            onChange={(e) => set("accountId", e.target.value)}
          >
            <NativeSelectOption value="">{t("allAccounts")}</NativeSelectOption>
            {accounts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.archived ? t("archivedAccount", { name: a.name }) : a.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="ledger-third-party">{t("thirdParty")}</FieldLabel>
          <NativeSelect
            id="ledger-third-party"
            value={value.thirdParty}
            onChange={(e) => set("thirdParty", e.target.value as ThirdPartyFilter)}
          >
            <NativeSelectOption value="all">{t("thirdPartyAll")}</NativeSelectOption>
            <NativeSelectOption value="only">{t("thirdPartyOnly")}</NativeSelectOption>
            <NativeSelectOption value="hide">{t("thirdPartyHide")}</NativeSelectOption>
          </NativeSelect>
        </Field>

        <div className="flex items-end">
          <Button
            variant="ghost"
            disabled={!isFiltering(value)}
            onClick={() => onChange(EMPTY_LEDGER_FILTERS)}
            data-testid="clear-ledger-filters"
          >
            <X aria-hidden="true" />
            {t("clearFilters")}
          </Button>
        </div>
      </div>
    </div>
  );
}
