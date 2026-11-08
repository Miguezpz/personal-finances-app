"use client";

/**
 * A block whose background flashes when `value` changes (spec 003 FR-030, spec 010 FR-007): the
 * goals' saved amounts and the net-worth tiles, like the buckets. The amount's text never animates.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFlashOnChange } from "./use-flash-on-change";

export function FlashOnChange({
  value,
  className,
  children,
  ...props
}: {
  value: unknown;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<"div">, "children">) {
  const { key, flashing } = useFlashOnChange(value);
  return (
    <div
      key={key}
      data-flashing={flashing || undefined}
      className={cn(flashing && "animate-balance-highlight", className)}
      {...props}
    >
      {children}
    </div>
  );
}
