"use client";

/**
 * Drag a bottom sheet down by its handle to close it (spec 010, FR-009, research R6). Native pointer
 * events, no library. Past 80 px — or released moving down at ≥ 0.5 px/ms — it closes; otherwise it
 * springs back (instantly under reduced motion). Only the handle starts a drag, so scrolling the
 * sheet's content never closes it; Escape and the close button stay the accessible way out.
 *
 * Closing after a drag continues the finger's motion: the sheet's exit keyframe (tw-animate `exit`)
 * only defines its end, so it starts from the dragged offset; we point that end at the bottom of
 * the screen instead of the default 40 px, otherwise a sheet dragged past 40 px bounced back up.
 */
import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export const DISMISS_DISTANCE_PX = 80;
export const DISMISS_VELOCITY_PX_PER_MS = 0.5;
/** A finger that stopped this long before lifting has no fling velocity left. */
const STALE_VELOCITY_MS = 80;
/** The release velocity is measured over this window, never over a single (possibly coalesced) event. */
const VELOCITY_WINDOW_MS = 100;
const MIN_VELOCITY_SPAN_MS = 32;

interface Sample {
  y: number;
  t: number;
}

/**
 * Downward speed (px/ms) at release, from the samples of the last VELOCITY_WINDOW_MS. A span shorter
 * than MIN_VELOCITY_SPAN_MS counts as that long, so two events a millisecond apart can't fake a fling;
 * a finger that rested before lifting has none.
 */
export function releaseVelocity(samples: readonly Sample[], releasedAt: number): number {
  const last = samples[samples.length - 1];
  if (!last || releasedAt - last.t > STALE_VELOCITY_MS) return 0;
  const first = samples.find((s) => last.t - s.t <= VELOCITY_WINDOW_MS) ?? last;
  return (last.y - first.y) / Math.max(MIN_VELOCITY_SPAN_MS, last.t - first.t);
}
const EXIT_MIN_MS = 120;
const EXIT_MAX_MS = 260;

/**
 * Duration of the exit after a drag: the rest of the sheet's height at the finger's speed (at
 * least the fling threshold), clamped so it never feels abrupt nor exceeds the motion budget.
 */
export function exitDurationMs(remainingPx: number, velocity: number): number {
  const speed = Math.max(velocity, DISMISS_VELOCITY_PX_PER_MS * 2);
  return Math.round(Math.min(EXIT_MAX_MS, Math.max(EXIT_MIN_MS, remainingPx / speed)));
}

export function shouldDismiss(distance: number, velocity: number): boolean {
  return distance > DISMISS_DISTANCE_PX || velocity >= DISMISS_VELOCITY_PX_PER_MS;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useDragToDismiss(contentRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const drag = useRef<{ startY: number; samples: Sample[] } | null>(null);

  const setOffset = (px: number, animate: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform var(--duration-base) var(--ease-out-quint)" : "none";
    el.style.transform = px > 0 ? `translateY(${px}px)` : "";
  };

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      drag.current = { startY: e.clientY, samples: [{ y: e.clientY, t: e.timeStamp }] };
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      d.samples.push({ y: e.clientY, t: e.timeStamp });
      while (d.samples.length > 2 && e.timeStamp - (d.samples[0]?.t ?? 0) > VELOCITY_WINDOW_MS) {
        d.samples.shift();
      }
      setOffset(Math.max(0, e.clientY - d.startY), false);
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const distance = Math.max(0, e.clientY - d.startY);
      const velocity = releaseVelocity(d.samples, e.timeStamp);
      if (shouldDismiss(distance, velocity)) {
        const el = contentRef.current;
        if (el && !prefersReducedMotion()) {
          // Keep the offset and let the exit keyframe carry the sheet from it off the screen,
          // without fading, decelerating like a released fling.
          const remaining = Math.max(0, el.offsetHeight - distance);
          el.style.setProperty("--tw-exit-translate-y", "100%");
          el.style.setProperty("--tw-exit-opacity", "1");
          el.style.setProperty("--tw-ease", "var(--ease-out-quint)");
          el.style.setProperty(
            "--tw-animation-duration",
            `${exitDurationMs(remaining, velocity)}ms`,
          );
        }
        onDismiss();
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
