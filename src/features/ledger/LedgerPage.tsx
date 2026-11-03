"use client";

/**
 * Ledger (T125, FR-042): every movement in one list, filterable by date, category, account, type
 * and third party, with client-side pagination and totals of the filtered set. Third-party
 * collections are shown but flagged, since they aren't personal income (FR-027).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Money } from "@/components/money/Money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { filterLedger } from "@/domain/ledger";
import type { Cents } from "@/domain/types";
import { ExportButton } from "./ExportButton";
import {
  EMPTY_LEDGER_FILTERS,
  isFiltering,
  type LedgerFilterState,
  toLedgerFilter,
} from "./filters";
import { useLedger, useLedgerLookups } from "./hooks";
import { LedgerFilters } from "./LedgerFilters";
import { LedgerTable } from "./LedgerTable";

export const LEDGER_PAGE_SIZE = 25;

export function LedgerPage() {
  const t = useTranslations("ledger");
  const { data: ledger } = useLedger();
  const { data: lookups } = useLedgerLookups();
  const [filters, setFilters] = useState<LedgerFilterState>(EMPTY_LEDGER_FILTERS);
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () =>
      ledger && lookups ? filterLedger(ledger, toLedgerFilter(filters, lookups.subcategories)) : [],
    [ledger, lookups, filters],
  );
  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const e of filtered) {
      if (e.amount > 0) inflow += e.amount;
      else outflow += e.amount;
    }
    return { inflow: inflow as Cents, outflow: outflow as Cents, net: (inflow + outflow) as Cents };
  }, [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / LEDGER_PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * LEDGER_PAGE_SIZE, (current + 1) * LEDGER_PAGE_SIZE);

  function onFiltersChange(next: LedgerFilterState) {
    setFilters(next);
    setPage(0);
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <ExportButton {...(isFiltering(filters) ? { entries: filtered } : {})} />
      </header>

      {!ledger || !lookups ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-32" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <LedgerFilters value={filters} onChange={onFiltersChange} lookups={lookups} />

          <dl className="grid grid-cols-3 gap-2 text-sm" data-testid="ledger-totals">
            <div className="flex flex-col rounded-lg border p-3">
              <dt className="text-muted-foreground">{t("inflow")}</dt>
              <dd className="font-semibold">
                <Money cents={totals.inflow} />
              </dd>
            </div>
            <div className="flex flex-col rounded-lg border p-3">
              <dt className="text-muted-foreground">{t("outflow")}</dt>
              <dd className="font-semibold">
                <Money cents={totals.outflow} />
              </dd>
            </div>
            <div className="flex flex-col rounded-lg border p-3">
              <dt className="text-muted-foreground">{t("net")}</dt>
              <dd className="font-semibold">
                <Money cents={totals.net} signed />
              </dd>
            </div>
          </dl>

          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {ledger.length === 0 ? t("empty") : t("noMatches")}
            </p>
          ) : (
            <>
              <LedgerTable entries={visible} lookups={lookups} />
              <nav
                className="flex items-center justify-between gap-2 text-sm"
                aria-label={t("pagination")}
              >
                <p className="text-muted-foreground" data-testid="ledger-count">
                  {t("showing", {
                    from: current * LEDGER_PAGE_SIZE + 1,
                    to: current * LEDGER_PAGE_SIZE + visible.length,
                    total: filtered.length,
                  })}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t("previousPage")}
                    disabled={current === 0}
                    onClick={() => setPage(current - 1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <span className="px-2 tabular-nums">
                    {t("pageOf", { page: current + 1, pages })}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t("nextPage")}
                    disabled={current >= pages - 1}
                    onClick={() => setPage(current + 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            </>
          )}
        </>
      )}
    </section>
  );
}
