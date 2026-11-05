"use client";

/**
 * Theme control (spec 003, FR-015). The Radix menu (ThemeMenu) loads in its own chunk right after hydration; until
 * then an identical, disabled trigger keeps the layout stable. Keeps the menu out of the First Load JS (SC-006).
 */
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Monitor, Moon, Sun, Zap, type LucideIcon } from "lucide-react";
import { selectTheme, usePreferences, type ThemePreference } from "@/store/preferences";

const ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  neon: Zap,
  system: Monitor,
};

function ThemeTogglePlaceholder({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const Icon = ICONS[usePreferences(selectTheme)];
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled
      aria-label={t("toggle")}
      data-testid="theme-toggle"
      className={className}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

const ThemeMenu = dynamic(() => import("./ThemeMenu"), {
  ssr: false,
  loading: () => <ThemeTogglePlaceholder />,
});

export function ThemeToggle({ className }: { className?: string }) {
  return <ThemeMenu {...(className ? { className } : {})} />;
}
