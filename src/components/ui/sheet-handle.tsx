"use client";

/**
 * The grab handle of a bottom sheet (spec 010, US4): drag it down to close (useDragToDismiss).
 * Decorative for assistive technology — Escape and the close button stay the accessible way out.
 * `onDismiss` clicks the sheet's hidden Radix Close so the normal close path (and its exit animation)
 * runs.
 */
import { useRef, type RefObject } from "react";
import { useDragToDismiss } from "@/components/motion/use-drag-to-dismiss";
import { cn } from "@/lib/utils";

export function SheetHandle({
  contentRef,
  closeRef,
  className,
}: {
  contentRef: RefObject<HTMLElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  className?: string;
}) {
  const handlers = useDragToDismiss(contentRef, () => closeRef.current?.click());
  return (
    <div
      aria-hidden="true"
      data-testid="sheet-handle"
      className={cn(
        "-mt-2 -mb-1 flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing",
        className,
      )}
      {...handlers}
    >
      <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

/** Refs a sheet needs for its handle: the moving content and a hidden Close to click. */
export function useSheetHandleRefs() {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  return { contentRef, closeRef };
}
