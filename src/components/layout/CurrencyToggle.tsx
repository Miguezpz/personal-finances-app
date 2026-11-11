"use client";

/**
 * Display currency switch (T109, FR-034/037): MXN · USD · EUR. Only changes how amounts are shown;
 * the choice persists on the device (preferences store).
 */
import { useTranslations } from "next-intl";
import type { DisplayCurrency } from "@/domain/types";
import { cn } from "@/lib/utils";
import { DISPLAY_CURRENCIES, selectDisplayCurrency, usePreferences } from "@/store/preferences";

export function CurrencyToggle() {
  const t = useTranslations("fx");
  const current = usePreferences(selectDisplayCurrency);
  const setCurrency = usePreferences((s) => s.setDisplayCurrency);

  return (
    <div
      role="group"
      aria-label={t("currencyLabel")}
      className="flex rounded-md border p-0.5"
      data-testid="currency-toggle"
    >
      {DISPLAY_CURRENCIES.map((c: DisplayCurrency) => (
        <button
          key={c}
          type="button"
          aria-pressed={current === c}
          onClick={() => setCurrency(c)}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium tabular-nums transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            current === c
              ? "bg-nav-active text-nav-active-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
