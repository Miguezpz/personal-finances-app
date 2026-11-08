"use client";

/**
 * Route transition inside the app (spec 003 FR-028, spec 010 FR-001/FR-003). A template remounts per route (unlike
 * the layout), so its <ViewTransition> sees the old page exit and the new one enter on every navigation — Next's
 * navigations are transitions. Classes `page-out` / `page-in` live in globals.css; without View Transitions support
 * the page simply swaps. `useRevealOnLoad` fades in what replaces a loading skeleton. Under reduced motion both are
 * instant (globals.css kill-switch and the hook's own check).
 */
import { useRef, ViewTransition } from "react";
import { useRevealOnLoad } from "@/components/motion/use-reveal-on-load";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useRevealOnLoad(ref);
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div ref={ref}>{children}</div>
    </ViewTransition>
  );
}
