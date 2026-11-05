"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";
import { resolveTheme, selectTheme, usePreferences } from "@/store/preferences";

const Toaster = ({ ...props }: ToasterProps) => {
  // Same theme as the app (spec 003, research R4): the stored preference, "system" resolved live.
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved = resolveTheme(usePreferences(selectTheme), prefersDark);
  // Sonner only knows light/dark; neon is a dark theme (its colors come from the CSS vars below).
  const theme = resolved === "neon" ? "dark" : resolved;

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        // The check pops in (FR-033); collapsed by the reduced-motion rule in globals.css.
        success: <CircleCheckIcon className="size-4 animate-in duration-base zoom-in-50" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
