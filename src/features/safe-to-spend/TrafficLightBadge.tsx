"use client";

/** Semáforo badge (T074): color + icon + text, never color alone (accessibility). */
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { TrafficLight } from "@/domain/types";
import { cn } from "@/lib/utils";

export const LIGHT_STYLES: Record<TrafficLight, { badge: string; bar: string; icon: LucideIcon }> =
  {
    green: {
      // Brand green (FR-012); amber and red stay as alerts.
      badge: "bg-surface-highlight text-success ring-success/25",
      bar: "bg-primary",
      icon: CircleCheck,
    },
    yellow: {
      badge: "bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-300",
      bar: "bg-amber-500",
      icon: CircleAlert,
    },
    red: {
      badge: "bg-red-50 text-red-800 ring-red-600/20 dark:bg-red-950 dark:text-red-300",
      bar: "bg-red-500",
      icon: OctagonAlert,
    },
    neutral: {
      badge: "bg-muted text-foreground ring-border",
      bar: "bg-muted-foreground/40",
      icon: CircleDashed,
    },
  };

export function TrafficLightBadge({
  light,
  className,
}: {
  light: TrafficLight;
  className?: string;
}) {
  const t = useTranslations("dashboard");
  const { badge, icon: Icon } = LIGHT_STYLES[light];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 transition-colors duration-base ring-inset",
        badge,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {t(`light.${light}`)}
    </span>
  );
}
