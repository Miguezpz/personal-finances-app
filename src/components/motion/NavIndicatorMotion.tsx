"use client";

/**
 * Sliding active-section indicator (spec 003, FR-028, contracts/ui-theme.md §6), loaded lazily by
 * src/components/layout/NavIndicator.tsx so Framer Motion stays out of the First Load JS (SC-006). Decorative (`aria-hidden`): the
 * active link already carries `aria-current="page"`. It measures the active link — or its `[data-nav-anchor]`, e.g.
 * the icon pill of the bottom bar — relative to the list and glides there (y/height in the sidebar, x/width in the
 * bottom bar). No `layoutId` (that needs the heavier `domMax` features, research R8). Under reduced motion it jumps.
 *
 * While measured, the list gets `data-indicator="ready"` so the links can drop their own active background
 * (the indicator paints it); before that — or with no active link in the list — the links keep it.
 */
import { domAnimation, LazyMotion, m, MotionConfig, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;

function measure(list: HTMLElement): Box | null {
  const active = list.querySelector<HTMLElement>('[aria-current="page"]');
  if (!active) return null;
  const target = active.querySelector<HTMLElement>("[data-nav-anchor]") ?? active;
  const a = target.getBoundingClientRect();
  const l = list.getBoundingClientRect();
  if (a.width === 0 || a.height === 0) return null;
  return { x: a.left - l.left, y: a.top - l.top, width: a.width, height: a.height };
}

export default function NavIndicatorMotion({
  listRef,
  className,
}: {
  listRef: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const next = measure(list);
      if (next) list.dataset.indicator = "ready";
      else delete list.dataset.indicator;
      setBox(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => {
      observer.disconnect();
      delete list.dataset.indicator;
    };
  }, [listRef, pathname]);

  if (!box) return null;
  // `strict`: only the light `m.*` components; MotionConfig skips transform animations under reduced motion.
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.span
          aria-hidden="true"
          className={cn("pointer-events-none absolute top-0 left-0 bg-nav-active", className)}
          initial={false}
          animate={{ x: box.x, y: box.y, width: box.width, height: box.height }}
          transition={reduced ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT_QUINT }}
        />
      </MotionConfig>
    </LazyMotion>
  );
}
