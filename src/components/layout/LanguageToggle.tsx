"use client";

/**
 * Global EN/ES switch (T116, FR-038…040). Changes the store's locale: next-intl re-renders the
 * texts in place — no reload, no remount, so half-filled forms keep their content. The choice
 * persists on the device (and in the NEXT_LOCALE cookie for the first paint).
 */
import { useTranslations } from "next-intl";
import type { Locale } from "@/domain/types";
import { cn } from "@/lib/utils";
import { LOCALES, selectLocale, usePreferences } from "@/store/preferences";

export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations("common");
  const current = usePreferences(selectLocale);
  const setLocale = usePreferences((s) => s.setLocale);

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn("flex rounded-md border p-0.5", className)}
      data-testid="language-toggle"
    >
      {LOCALES.map((locale: Locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={current === locale}
          onClick={() => setLocale(locale)}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium uppercase transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            current === locale
              ? "bg-nav-active text-nav-active-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {/* Visible code + spoken name: the accessible name contains the visible text (WCAG 2.5.3). */}
          {locale}
          <span className="sr-only"> {t(`languageName.${locale}`)}</span>
        </button>
      ))}
    </div>
  );
}
