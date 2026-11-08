"use client";

/**
 * Mobile appearance panel (spec 003, FR-021, research R12; renamed "Appearance" in spec 008, FR-016, so it isn't
 * confused with the Settings › Preferences page): the compact mobile header keeps only the logo, privacy
 * and this button; language, currency, theme and sign-out live in a bottom sheet. It's a dialog (not a menu), so the
 * toggles keep their button semantics and their data-testids.
 */
import { Coins, Languages, LogOut, type LucideIcon, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useUi } from "@/store/ui";
import { CurrencyToggle } from "./CurrencyToggle";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

function Row({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        {Icon && (
          <Icon aria-hidden="true" focusable="false" className="size-4 text-muted-foreground" />
        )}
        {label}
      </span>
      {children}
    </div>
  );
}

export function PreferencesSheet({
  onSignOut,
  extra,
}: {
  onSignOut?: () => void;
  /** Additional rows (e.g. the theme control). */
  extra?: ReactNode;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const tfx = useTranslations("fx");
  const tTheme = useTranslations("theme");
  const open = useUi((s) => s.preferencesOpen);
  const setOpen = useUi((s) => s.setPreferencesOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label={t("appearance")}
          data-testid="preferences-open"
        >
          <SlidersHorizontal aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        data-testid="preferences-sheet"
      >
        <SheetHeader className="p-0">
          <SheetTitle>{t("appearance")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2">
          <Row label={tc("language")} icon={Languages}>
            <LanguageToggle />
          </Row>
          <Row label={tfx("currencyLabel")} icon={Coins}>
            <CurrencyToggle />
          </Row>
          <Row label={tTheme("toggle")}>
            <ThemeToggle className="border" />
          </Row>
          {extra}
        </div>
        {onSignOut && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut aria-hidden="true" />
            {t("signOut")}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
