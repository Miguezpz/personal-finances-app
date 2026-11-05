/**
 * Brand mark (spec 003, FR-009, research R7): a growth monogram — three ascending emerald bars on an ink
 * rounded square (acid bars on black in the neon theme: --mark-surface / --mark-bar). Inline SVG (no request,
 * follows the theme). Decorative: always next to the app name
 * (visible or sr-only).
 */
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-testid="brand-mark"
      className={cn("size-6 shrink-0", className)}
    >
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="6"
        fill="var(--mark-surface, #052e2b)"
        stroke="var(--border, #d1e7e0)"
      />
      <rect x="5.5" y="13" width="3" height="5.5" rx="1" fill="var(--mark-bar, #34d399)" />
      <rect x="10.5" y="9.5" width="3" height="9" rx="1" fill="var(--mark-bar, #34d399)" />
      <rect x="15.5" y="5.5" width="3" height="13" rx="1" fill="var(--mark-bar, #34d399)" />
    </svg>
  );
}
