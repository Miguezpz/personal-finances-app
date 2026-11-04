"use client";

/**
 * Lazy entry point of the sliding nav indicator (spec 003, FR-028). The indicator is decorative and the active link
 * paints its own background until the indicator is measured, so it can arrive after hydration: this keeps Framer
 * Motion in an async chunk, outside the First Load JS (SC-006, research R8).
 */
import dynamic from "next/dynamic";

export const NavIndicator = dynamic(() => import("@/components/motion/NavIndicatorMotion"), {
  ssr: false,
});
