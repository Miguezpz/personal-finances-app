"use client";

/**
 * Theme menu (spec 003, FR-015, research R13): Light / Dark / Neon / System as a radio menu (menuitemradio tells screen
 * readers which one is selected). Loaded lazily by ThemeToggle so the Radix menu isn't in the First Load JS. The choice persists on the device and is applied by <PreferencesEffects />; the
 * inline boot script applies it before the first paint on the next visit.
 */
import { Monitor, Moon, Sun, Zap, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isThemePreference,
  selectTheme,
  usePreferences,
  type ThemePreference,
} from "@/store/preferences";

export const THEME_ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  neon: Zap,
  system: Monitor,
};
const OPTIONS: readonly ThemePreference[] = ["light", "dark", "neon", "system"];

export default function ThemeMenu({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const theme = usePreferences(selectTheme);
  const setTheme = usePreferences((s) => s.setTheme);
  const Icon = THEME_ICONS[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("toggle")}
          title={`${t("toggle")}: ${t(theme)}`}
          data-testid="theme-toggle"
          className={className}
        >
          <Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (isThemePreference(value)) setTheme(value);
          }}
        >
          {OPTIONS.map((option) => {
            const OptionIcon = THEME_ICONS[option];
            return (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                data-testid={`theme-option-${option}`}
                className="pointer-coarse:min-h-11"
              >
                <OptionIcon aria-hidden="true" />
                {t(option)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
