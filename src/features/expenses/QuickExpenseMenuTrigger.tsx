"use client";

/**
 * Trigger of a quick expense's "⋯" menu. Its own module (no Radix import), so QuickExpenseBar can
 * show it — disabled — while the menu's chunk loads, without pulling the menu into First Load JS.
 */
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuickExpenseMenuTrigger({
  templateId,
  label,
  ...props
}: { templateId: string; label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 w-9 rounded-l-none border-l-0 px-0"
      aria-label={label}
      data-testid={`quick-expense-menu-${templateId}`}
      {...props}
    >
      <MoreHorizontal aria-hidden="true" />
    </Button>
  );
}
