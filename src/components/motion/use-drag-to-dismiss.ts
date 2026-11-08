"use client";

/**
 * Drag a bottom sheet down by its handle to close it (spec 010, FR-009, research R6). Native pointer
 * events, no library. Past 80 px — or released moving down at ≥ 0.5 px/ms — it closes; otherwise it
 * springs back (instantly under reduced motion). Only the handle starts a drag, so scrolling the
 * sheet's content never closes it; Escape and the close button stay the accessible way out.
 */
import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export const DISMISS_DISTANCE_PX = 80;
export const DISMISS_VELOCITY_PX_PER_MS = 0.5;

export function shouldDismiss(distance: number, velocity: number): boolean {
  return distance > DISMISS_DISTANCE_PX || velocity >= DISMISS_VELOCITY_PX_PER_MS;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useDragToDismiss(contentRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const drag = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(
    null,
  );

  const setOffset = (px: number, animate: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform var(--duration-base) var(--ease-out-quint)" : "none";
    el.style.transform = px > 0 ? `translateY(${px}px)` : "";
  };

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      const dt = Math.max(1, e.timeStamp - d.lastT);
      d.velocity = (e.clientY - d.lastY) / dt;
      d.lastY = e.clientY;
      d.lastT = e.timeStamp;
      setOffset(Math.max(0, e.clientY - d.startY), false);
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const distance = Math.max(0, e.clientY - d.startY);
      if (shouldDismiss(distance, d.velocity)) {
        onDismiss();
        // Leave the offset: the sheet's own exit animation takes over from there.
        return;
      }
      setOffset(0, !prefersReducedMotion());
    },
    onPointerCancel() {
      drag.current = null;
      setOffset(0, !prefersReducedMotion());
    },
  };
}
