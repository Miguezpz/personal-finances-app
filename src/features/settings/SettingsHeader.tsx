"use client";

/** Header of every settings sub-page (spec 008, FR-014/FR-015): the shared PageHeader with the
 * section's icon and the "‹ Settings" link back to the index. */
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { settingsIcon } from "./settings-sections";

interface Props {
  /** The sub-page's route, e.g. "/settings/rules" (picks its icon). */
  href: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function SettingsHeader({ href, title, description, action }: Props) {
  const t = useTranslations("settings");
  return (
    <PageHeader
      icon={settingsIcon(href)}
      title={title}
      description={description}
      actions={action}
      back={{ href: "/settings", label: t("title") }}
    />
  );
}
