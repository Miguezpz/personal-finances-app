/**
 * Default user settings (mirror the column defaults of public.user_settings).
 * Used when the settings row doesn't exist yet, by onboarding and by the demo data.
 */
import { bps } from "./money";
import type { UserSettings } from "./types";

export const DEFAULT_TIMEZONE = "America/Mexico_City";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  timezone: DEFAULT_TIMEZONE,
  firstPayday: 15,
  secondPayday: 31,
  greenMinBps: bps(5000),
  yellowMinBps: bps(2000),
  collectionLeadDays: 3,
  emergencyFundMonths: 6,
};
