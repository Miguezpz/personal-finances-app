"use client";

/**
 * The "⋯" menu of a quick expense (spec 005, FR-007a): "Yesterday" and "Record with another amount
 * or date". Loaded in its own chunk by QuickExpenseBar, so the Radix menu stays out of the
 * Dashboard's First Load JS (plan: < 5 KB gzip). Non-modal: the rest of the page isn't hidden
 * from assistive technology while it's open.
 */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickExpenseMenuTrigger } from "./QuickExpenseMenuTrigger";

export interface QuickExpenseMenuProps {
  templateId: string;
  label: string;
  disabled: boolean;
  yesterdayLabel: string;
  customizeLabel: string;
  onYesterday: () => void;
  onCustomize: () => void;
}

export default function QuickExpenseMenu({
  templateId,
  label,
  disabled,
  yesterdayLabel,
  customizeLabel,
  onYesterday,
  onCustomize,
}: QuickExpenseMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <QuickExpenseMenuTrigger templateId={templateId} label={label} disabled={disabled} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem data-testid="quick-expense-yesterday" onSelect={onYesterday}>
          {yesterdayLabel}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="quick-expense-customize" onSelect={onCustomize}>
          {customizeLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
