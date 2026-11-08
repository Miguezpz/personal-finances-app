"use client";

/**
 * Mobile alert strip (spec 008, US5, FR-019): the Dashboard's alerts — an overspent bucket, upcoming
 * or overdue collections — as compact rows at the top, each one a link to where it's resolved. The
 * bucket balances stay the first highlighted block; desktop keeps the full alerts in its grid.
 */
import { ChevronRight, HandCoins, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCollectionAlerts } from "@/features/receivables/CollectionAlerts";
import { CardDueRow, useCardDueAlerts } from "./CardDueAlerts";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: "destructive" | "default";
}

export function DashboardAlertStrip({ overspentBuckets }: { overspentBuckets: string[] }) {
  const t = useTranslations("dashboard");
  const tr = useTranslations("receivables");
  const { alerts } = useCollectionAlerts();
  const cardsDue = useCardDueAlerts();

  const rows: Row[] = [];
  if (overspentBuckets.length > 0)
    rows.push({
      key: "overspent",
      href: "/expenses",
      icon: TriangleAlert,
      label: `${t("overspentTitle")} · ${overspentBuckets.join(", ")}`,
      tone: "destructive",
    });
  if (alerts.length > 0)
    rows.push({
      key: "collections",
      href: "/receivables",
      icon: HandCoins,
      label: tr("alertsTitle", { count: alerts.length }),
      tone: "default",
    });
  if (rows.length === 0 && cardsDue.length === 0) return null;

  return (
    <nav aria-label={t("alertsLabel")} className="md:hidden" data-testid="dashboard-alert-strip">
      <ul className="flex flex-col divide-y overflow-hidden rounded-lg border">
        {rows.map(({ key, href, icon: Icon, label, tone }) => (
          <li key={key}>
            <Link
              href={href}
              data-testid={`alert-strip-${key}`}
              className={cn(
                "flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-fast hover:bg-muted",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                tone === "destructive" && "text-destructive",
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
        {/* Spec 009 (FR-025): cards due within 7 days, with "Pay". */}
        {cardsDue.map((a) => (
          <li key={a.statement.card.id}>
            <CardDueRow alert={a} className="px-3 py-2" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
