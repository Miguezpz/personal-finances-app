/**
 * Shared empty state (spec 004, FR-015): a large, faint page icon above the message, with an
 * optional action. Replaces the dashed-border paragraphs each page had; same look in light and
 * dark. The icon is decorative — the message is what assistive technology reads.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  children,
  action,
  className,
  ...props
}: {
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"div">, "children">) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center text-muted-foreground",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" focusable="false" className="size-8 text-muted-foreground/60" />
      <p>{children}</p>
      {action}
    </div>
  );
}
