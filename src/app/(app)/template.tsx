"use client";

/**
 * Route transition inside the app (spec 003 FR-028, spec 010 FR-001–FR-003). A template remounts per route (unlike
 * the layout), so the `animate-page-in` CSS animation replays on every navigation: the new page fades in rising 4 px.
 * It used to be a React <ViewTransition>, but its snapshots sit in a layer above the whole page: on iOS the bottom bar
 * and the header vanished or were covered for a moment on every tap. A plain animation on the page keeps the shell
 * out of it, the same in every browser. `useRevealOnLoad` fades in what replaces a loading skeleton. Under reduced
 * motion both are instant (globals.css kill-switch and the hook's own check).
 */
import { useRef } from "react";
import { useRevealOnLoad } from "@/components/motion/use-reveal-on-load";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useRevealOnLoad(ref);
  return (
    <div ref={ref} className="animate-page-in">
      {children}
    </div>
  );
}
