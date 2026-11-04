"use client";

/**
 * Theme control (spec 003, FR-015, research R13): Light / Dark / System as a radio menu (menuitemradio tells screen
 * readers which one is selected). The choice persists on the device and is applied by <PreferencesEffects />; the
 * inline boot script applies it before the first paint on the next visit.
 */
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
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

const ICONS: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };
const OPTIONS: readonly ThemePreference[] = ["light", "dark", "system"];

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const theme = usePreferences(selectTheme);
  const setTheme = usePreferences((s) => s.setTheme);
  const Icon = ICONS[theme];

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
            const OptionIcon = ICONS[option];
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
