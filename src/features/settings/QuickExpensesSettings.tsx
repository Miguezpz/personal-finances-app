"use client";

/** Settings › Quick expenses (spec 009, US7, FR-029): template management moved out of Expenses. */
import { useTranslations } from "next-intl";
import { QuickExpensesSection } from "@/features/expenses/QuickExpensesSection";
import { SettingsHeader } from "./SettingsHeader";

export function QuickExpensesSettings() {
  const t = useTranslations("settings");
  return (
    <section className="flex flex-col gap-6">
      <SettingsHeader
        href="/settings/quick-expenses"
        title={t("quickExpensesTitle")}
        description={t("quickExpensesDescription")}
      />
      <QuickExpensesSection inSettings />
    </section>
  );
}
