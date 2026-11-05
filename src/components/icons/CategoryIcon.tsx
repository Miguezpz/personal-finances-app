/**
 * Decorative taxonomy icon (spec 004, FR-013/FR-016): always next to the name, never instead of
 * it, hidden from assistive technology. The caller resolves the key with `resolveTaxonomyIcon`
 * (subcategory → category → generic).
 */
import { cn } from "@/lib/utils";
import type { ResolvedTaxonomyIcon } from "@/domain/icons";
import { CATEGORY_ICONS, GENERIC_CATEGORY_ICON } from "./category-icons";

export function CategoryIcon({
  icon,
  className,
}: {
  icon: ResolvedTaxonomyIcon;
  className?: string;
}) {
  const Icon = icon === "generic" ? GENERIC_CATEGORY_ICON : CATEGORY_ICONS[icon];
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      data-icon={icon}
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  );
}
