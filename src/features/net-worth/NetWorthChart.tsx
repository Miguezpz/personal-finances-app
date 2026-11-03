"use client";

/**
 * Net worth history (T146, FR-031, US10-4): monthly snapshots of assets, liabilities and net worth
 * on ONE money axis (all three are MXN amounts). Ticks and tooltips go through the masked chart
 * helpers (privacy, display currency); a legend names every series (identity is never color
 * alone) and a table view carries the same numbers.
 *
 * Colors: validated categorical slots 1–3 (--series-1..3 in globals.css, light and dark).
 */
import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis } from "recharts";
import { MaskedTooltip, MaskedYAxis } from "@/components/charts/MaskedAxis";
import { Money } from "@/components/money/Money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IsoDate, NetWorthSnapshot } from "@/domain/types";
import { formatMonth } from "@/i18n/format";
import { selectLocale, usePreferences } from "@/store/preferences";

export const NET_WORTH_SERIES = [
  { key: "netWorth", color: "var(--series-1)" },
  { key: "liabilities", color: "var(--series-2)" },
  { key: "assets", color: "var(--series-3)" },
] as const;

type SeriesKey = (typeof NET_WORTH_SERIES)[number]["key"];

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

export function NetWorthChart({ snapshots }: { snapshots: readonly NetWorthSnapshot[] }) {
  const t = useTranslations("netWorth");
  const locale = usePreferences(selectLocale);
  const data = [...snapshots]
    .sort((a, b) => (a.snapshotOn < b.snapshotOn ? -1 : 1))
    .map((s) => ({
      on: s.snapshotOn,
      netWorth: s.netWorth,
      liabilities: s.liabilities,
      assets: s.assets,
    }));
  const single = data.length === 1;
  const name = (key: SeriesKey) => t(`series.${key}`);

  return (
    <figure className="flex flex-col gap-3" data-testid="net-worth-chart">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label={t("legend")}>
        {NET_WORTH_SERIES.map(({ key, color }) => (
          <li key={key} className="flex items-center gap-2 text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            {name(key)}
          </li>
        ))}
      </ul>

      <div className="h-72 w-full" role="img" aria-label={t("chartLabel")}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="on"
              tickFormatter={(on: IsoDate) => formatMonth(on, locale)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <MaskedYAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={84} />
            <MaskedTooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              labelFormatter={(on) => formatMonth(on as IsoDate, locale, "long")}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 13,
              }}
              itemStyle={{ color: "var(--popover-foreground)" }}
              separator=": "
              // Same order as the legend.
              itemSorter={(item) => NET_WORTH_SERIES.findIndex((x) => x.key === item.dataKey)}
            />
            {NET_WORTH_SERIES.map(({ key, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={name(key)}
                stroke={color}
                strokeWidth={2}
                dot={
                  single
                    ? { r: 4, fill: color, stroke: "var(--background)", strokeWidth: 2 }
                    : false
                }
                activeDot={{ r: 5, fill: color, stroke: "var(--background)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {t("showTable")}
        </summary>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>{t("month")}</TableHead>
              {NET_WORTH_SERIES.map(({ key }) => (
                <TableHead key={key} className="text-right">
                  {name(key)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data].reverse().map((row) => (
              <TableRow key={row.on}>
                <TableCell>{formatMonth(row.on, locale, "long")}</TableCell>
                {NET_WORTH_SERIES.map(({ key }) => (
                  <TableCell key={key} className="text-right">
                    <Money cents={row[key]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </figure>
  );
}
