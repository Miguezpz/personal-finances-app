/** The settings sub-pages, with the icon each one shows on the index and in its own header
 * (spec 008, FR-014): one source for both. */
import { Landmark, type LucideIcon, Percent, SlidersHorizontal, Tags, Zap } from "lucide-react";

export interface SettingsSection {
  href: string;
  icon: LucideIcon;
  title:
    "rulesLink" | "accountsTitle" | "categoriesTitle" | "quickExpensesTitle" | "preferencesTitle";
  hint:
    | "rulesLinkHint"
    | "accountsLinkHint"
    | "categoriesLinkHint"
    | "quickExpensesLinkHint"
    | "preferencesLinkHint";
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { href: "/settings/rules", icon: Percent, title: "rulesLink", hint: "rulesLinkHint" },
  { href: "/settings/accounts", icon: Landmark, title: "accountsTitle", hint: "accountsLinkHint" },
  {
    href: "/settings/categories",
    icon: Tags,
    title: "categoriesTitle",
    hint: "categoriesLinkHint",
  },
  {
    href: "/settings/quick-expenses",
    icon: Zap,
    title: "quickExpensesTitle",
    hint: "quickExpensesLinkHint",
  },
  {
    href: "/settings/preferences",
    icon: SlidersHorizontal,
    title: "preferencesTitle",
    hint: "preferencesLinkHint",
  },
];

export function settingsIcon(href: string): LucideIcon {
  const section = SETTINGS_SECTIONS.find((s) => s.href === href);
  if (!section) throw new Error(`No settings section for ${href}`);
  return section.icon;
}
