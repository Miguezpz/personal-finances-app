"use client";

import type * as React from "react";
import { MD_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { Button } from "./button";

/**
 * A screen's highlighted call to action from `md` up; below it the floating "Add expense" button is the only CTA
 * (spec 003, FR-006, Clarifications Q2), so this one falls back to the regular primary style.
 */
export function ResponsiveCtaButton(props: Omit<React.ComponentProps<typeof Button>, "variant">) {
  const desktop = useMediaQuery(MD_QUERY, true);
  return <Button {...props} variant={desktop ? "cta" : "default"} />;
}
