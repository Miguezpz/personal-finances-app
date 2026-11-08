"use client";

/**
 * A toggle chip (spec 009): date shortcuts, recent subcategories and list filters. A button with
 * `aria-pressed`, 44 px tall on touch screens, with the brand focus ring.
 */
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Chip({
  pressed,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-slot="chip"
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors duration-fast pointer-coarse:min-h-11",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
