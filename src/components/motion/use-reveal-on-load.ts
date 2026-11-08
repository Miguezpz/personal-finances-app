"use client";

/**
 * Reveal what replaces a loading skeleton (spec 010, FR-003, research R2). The route animation only
 * plays when the page mounts — a resolved query is a plain update — so this watches `main`: in the batch where an `[aria-busy="true"]` node disappears, the elements
 * inserted in that same batch fade in, rising 4 px (opacity/transform only, 200 ms). Nothing under
 * reduced motion. The amounts are already rendered (and masked when privacy is on) in the first
 * frame; only their container's opacity moves.
 */
import { useEffect, type RefObject } from "react";

const KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: "translateY(4px)" },
  { opacity: 1, transform: "none" },
];
const TIMING: KeyframeAnimationOptions = {
  duration: 200,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

const isBusy = (node: Node) =>
  node instanceof Element &&
  (node.matches('[aria-busy="true"]') || node.querySelector('[aria-busy="true"]') !== null);

export function useRevealOnLoad(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof MutationObserver === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const observer = new MutationObserver((records) => {
      if (reduced?.matches) return;
      const skeletonGone = records.some((r) => [...r.removedNodes].some(isBusy));
      if (!skeletonGone) return;
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node instanceof HTMLElement && !isBusy(node) && node.isConnected) {
            node.animate?.(KEYFRAMES, TIMING);
          }
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref]);
}
