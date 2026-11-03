"use client";

/**
 * Money on charts (T133, FR-045): every amount a chart shows — axis ticks and tooltips — goes
 * through `useMoneyFormatter`, so it converts to the display currency and turns into "••••"
 * with privacy mode on, exactly like <Money>. See README.md in this folder.
 *
 * Chart values are MXN cents (the source of truth), like everywhere else.
 */
import { type ComponentProps, useCallback } from "react";
import { Tooltip, YAxis, type YAxisProps } from "recharts";
import { useMoneyFormatter } from "@/components/money/Money";
import type { Cents } from "@/domain/types";

export interface ChartMoney {
  /** Compact (no cents) for axis ticks. */
  tick: (value: number) => string;
  /** Full amount for tooltips. */
  tooltip: (value: number) => string;
}

export function useChartMoney(): ChartMoney {
  const format = useMoneyFormatter();
  const tick = useCallback(
    (value: number) => format(Math.round(value) as Cents, { compact: true }),
    [format],
  );
  const tooltip = useCallback((value: number) => format(Math.round(value) as Cents), [format]);
  return { tick, tooltip };
}

/** Y axis whose ticks are money (masked with privacy on). */
export function MaskedYAxis(props: Omit<YAxisProps, "tickFormatter">) {
  const { tick } = useChartMoney();
  return <YAxis {...props} tickFormatter={(v: number) => tick(v)} />;
}

/** Tooltip whose values are money; series names pass through unchanged. */
export function MaskedTooltip(props: Omit<ComponentProps<typeof Tooltip>, "formatter">) {
  const { tooltip } = useChartMoney();
  return (
    <Tooltip
      {...props}
      formatter={(value) => (typeof value === "number" ? tooltip(value) : String(value ?? ""))}
    />
  );
}
