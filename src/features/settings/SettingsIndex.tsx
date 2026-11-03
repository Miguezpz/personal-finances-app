"use client";

/** Settings index (T126): links to every settings page plus the data export (Principle I). */
import {
  ChevronRight,
  Landmark,
  type LucideIcon,
  Percent,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/features/ledger/ExportButton";

interface Section {
  href: string;
  icon: LucideIcon;
  title: "rulesLink" | "accountsTitle" | "categoriesTitle" | "preferencesTitle";
  hint: "rulesLinkHint" | "accountsLinkHint" | "categoriesLinkHint" | "preferencesLinkHint";
}

const SECTIONS: readonly Section[] = [
  { href: "/settings/rules", icon: Percent, title: "rulesLink", hint: "rulesLinkHint" },
  { href: "/settings/accounts", icon: Landmark, title: "accountsTitle", hint: "accountsLinkHint" },
  {
    href: "/settings/categories",
    icon: Tags,
    title: "categoriesTitle",
    hint: "categoriesLinkHint",
  },
  {
    href: "/settings/preferences",
    icon: SlidersHorizontal,
    title: "preferencesTitle",
    hint: "preferencesLinkHint",
  },
];

export function SettingsIndex() {
  const t = useTranslations("settings");
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map(({ href, icon: Icon, title, hint }) => (
          <li key={href}>
            <Link
              href={href}
              className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader className="flex flex-row items-center gap-4">
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <CardTitle className="text-base">{t(title)}</CardTitle>
                    <CardDescription>{t(hint)}</CardDescription>
                  </div>
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{t("exportTitle")}</CardTitle>
            <CardDescription>{t("exportHint")}</CardDescription>
          </div>
          <ExportButton />
        </CardHeader>
      </Card>
    </section>
  );
}
