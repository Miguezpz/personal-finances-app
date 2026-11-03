"use client";

/**
 * Privacy mode switch (T132, FR-045): masks every amount, balance and chart value as "••••" on
 * this device. `aria-pressed` carries the state; <PreferencesEffects /> mirrors it to
 * <html data-privacy> (the CSS blur is a second layer) and it persists across reloads.
 */
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { selectPrivacyMode, usePreferences } from "@/store/preferences";

export function PrivacyToggle() {
  const t = useTranslations("privacy");
  const on = usePreferences(selectPrivacyMode);
  const toggle = usePreferences((s) => s.togglePrivacy);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-pressed={on}
      aria-label={t("toggle")}
      title={on ? t("on") : t("off")}
      onClick={toggle}
      data-testid="privacy-toggle"
    >
      {on ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  );
}
