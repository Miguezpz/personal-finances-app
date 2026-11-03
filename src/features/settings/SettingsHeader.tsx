"use client";

/** Header of every settings sub-page: back link to the settings index, title, hint, action. */
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface Props {
  title: string;
  description: string;
  action?: ReactNode;
}

export function SettingsHeader({ title, description, action }: Props) {
  const t = useTranslations("settings");
  return (
    <header className="flex flex-col gap-3">
      <Link
        href="/settings"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </header>
  );
}
