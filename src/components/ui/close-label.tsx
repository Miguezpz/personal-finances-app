"use client";

/** Translated "Close" for dialogs and sheets (the shadcn defaults hard-code English). */
import { useTranslations } from "next-intl";

export function CloseLabel() {
  return <>{useTranslations("common")("close")}</>;
}
