"use client";

/**
 * Desktop app-wide create button (spec 008, FR-010/FR-012): the screen's only highlighted call to
 * action. The Radix menu loads in its own chunk right after hydration; until then an identical,
 * disabled trigger keeps the header stable (same approach as ThemeToggle).
 */
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useCreateShortcuts } from "./use-create-shortcuts";

function NewMenuPlaceholder() {
  const t = useTranslations("create");
  return (
    <Button variant="cta" size="sm" disabled data-testid="new-menu">
      <Plus aria-hidden="true" />
      {t("newButton")}
    </Button>
  );
}

const NewMenuContent = dynamic(() => import("./NewMenuContent"), {
  ssr: false,
  loading: () => <NewMenuPlaceholder />,
});

export function NewMenu() {
  useCreateShortcuts();
  return (
    <div className="hidden md:block">
      <NewMenuContent />
    </div>
  );
}
