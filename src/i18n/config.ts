/**
 * i18n configuration (T046, research.md R10): next-intl WITHOUT locale routing. Both dictionaries
 * ship to the client (a few KB) and the active locale comes from the preferences store, so
 * switching is instant and never remounts the page (FR-039).
 */
import type { Locale } from "@/domain/types";
import en from "./messages/en.json";
import es from "./messages/es.json";

export type Messages = typeof en;

export const MESSAGES: Record<Locale, Messages> = { en, es };

/** BCP 47 tags used for number, currency and date formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-MX" };
