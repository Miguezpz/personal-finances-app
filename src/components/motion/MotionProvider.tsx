"use client";

/**
 * Motion for the whole app (spec 003, research R8/R9):
 * - LazyMotion + `strict`: only the lightweight `m.*` components are allowed (a stray `motion.*` throws), and the
 *   animation features download in a separate chunk after hydration.
 * - MotionConfig reducedMotion="user": with the OS "reduce motion" setting, transform/layout animations are skipped.
 */
import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

const loadFeatures = () => import("./features").then((m) => m.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
