"use client";

/**
 * Desktop "＋ New" menu (spec 008, FR-010): Expense / Income with their shortcuts.
 * Loaded lazily by NewMenu so the Radix menu isn't in the First Load JS (same as ThemeMenu).
 */
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUi } from "@/store/ui";
import { CREATE_ACTIONS } from "./create-actions";

export default function NewMenuContent() {
  const t = useTranslations("create");
  const openCreate = useUi((s) => s.openCreate);

  return (
    // Non-modal: the page stays in the accessibility tree (a modal menu hides it while focus could still reach it).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="cta" size="sm" data-testid="new-menu">
          <Plus aria-hidden="true" />
          {t("newButton")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {CREATE_ACTIONS.map(({ kind, labelKey, icon: Icon, shortcut, testId }) => (
          <DropdownMenuItem
            key={kind}
            data-testid={`new-${testId}`}
            onSelect={() => openCreate({ kind })}
          >
            <Icon aria-hidden="true" />
            {t(labelKey)}
            <DropdownMenuShortcut aria-label={t("shortcut", { key: shortcut.toUpperCase() })}>
              <kbd className="font-sans">{shortcut.toUpperCase()}</kbd>
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
