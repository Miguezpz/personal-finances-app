"use client";

/**
 * "Today" as a business date in the user's time zone (research.md R2). The domain never reads the
 * clock; components inject this. Re-checked every minute so a page left open past midnight rolls
 * over to the new date (and quincena).
 */
import { useEffect, useState } from "react";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { todayIn } from "@/domain/periods";
import { DEFAULT_TIMEZONE } from "@/domain/settings";
import type { FinanceSnapshot, IsoDate } from "@/domain/types";

const selectTimezone = (s: FinanceSnapshot) => s.settings.timezone;

export function useTimezone(): string {
  return useFinanceSnapshot(selectTimezone).data ?? DEFAULT_TIMEZONE;
}

export function useToday(): IsoDate {
  const timezone = useTimezone();
  const [today, setToday] = useState<{ tz: string; date: IsoDate }>(() => ({
    tz: timezone,
    date: todayIn(timezone, new Date()),
  }));

  useEffect(() => {
    const tick = () =>
      setToday((prev) => {
        const date = todayIn(timezone, new Date());
        return prev.tz === timezone && prev.date === date ? prev : { tz: timezone, date };
      });
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [timezone]);

  return today.date;
}
