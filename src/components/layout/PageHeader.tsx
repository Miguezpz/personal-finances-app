/**
 * Page title with the same icon the page has in the navigation (spec 004, FR-015). Keeps the
 * existing heading level, text and spacing; the icon is decorative (aria-hidden) so the heading's
 * accessible name is unchanged. Spec 008 (FR-014/FR-015): every page uses it, and `back` adds the
 * "‹ Settings" link of the settings sub-pages.
 */
import { ChevronLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  back,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="flex flex-col gap-1">
        {back && (
          <Link
            href={back.href}
            data-testid="page-back"
            className="mb-2 inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:min-h-11"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Icon
            aria-hidden="true"
            focusable="false"
            className="size-6 shrink-0 text-muted-foreground"
          />
          {title}
        </h1>
        {typeof description === "string" ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : (
          description
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
