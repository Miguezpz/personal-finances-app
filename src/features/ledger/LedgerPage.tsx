"use client";

/**
 * Ledger (T125, FR-042): every movement in one list, filterable by date, category, account, type
 * and third party, with client-side pagination and totals of the filtered set. Third-party
 * collections are shown but flagged, since they aren't personal income (FR-027).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Money } from "@/components/money/Money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { filterLedger } from "@/domain/ledger";
import { matchesSearch, presetRange } from "@/domain/ledger-presets";
import type { Cents, FinanceSnapshot, LedgerEntry } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { openCreate } from "@/store/ui";
import { ExportButton } from "./ExportButton";
import {
  filtersFromParams,
  filtersToParams,
  isFiltering,
  type LedgerFilterState,
  toLedgerFilter,
} from "./filters";
import { useLedger, useLedgerLookups } from "./hooks";
import { LedgerFilters } from "./LedgerFilters";
import { LedgerTable } from "./LedgerTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { navIcon } from "@/components/layout/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoadError } from "@/components/data/PageQueryState";
import { useSnapshotStatus } from "@/data/useFinanceSnapshot";

export const LEDGER_PAGE_SIZE = 25;

const selectEditable = (s: FinanceSnapshot) => ({ expenses: s.expenses, incomes: s.incomes });

export function LedgerPage() {
  const t = useTranslations("ledger");
  const snapshotStatus = useSnapshotStatus();
  const { data: ledger } = useLedger();
  const { data: lookups } = useLedgerLookups();
  const { data: entities } = useFinanceSnapshot(selectEditable);
  // Spec 009 (FR-021): the filters live in the URL, so a reload or a shared link keeps them.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useToday();
  const query = params.toString();
  // Local state answers at once (typing in the search box); the URL follows. Queries this page
  // wrote itself are skipped when they come back, so a slow round-trip never undoes a keystroke;
  // any other URL change (Back, a shared link) replaces the filters.
  const [filters, setFilters] = useState<LedgerFilterState>(() =>
    filtersFromParams(new URLSearchParams(query), today),
  );
  const written = useRef(new Set<string>());
  useEffect(() => {
    if (written.current.has(query)) {
      written.current.delete(query);
      return;
    }
    setFilters(filtersFromParams(new URLSearchParams(query), today));
  }, [query, today]);
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () =>
      ledger && lookups
        ? filterLedger(ledger, toLedgerFilter(filters, lookups.subcategories)).filter((e) =>
            matchesSearch([e.description], filters.q),
          )
        : [],
    [ledger, lookups, filters],
  );

  // Spec 009 (FR-023): expense and income rows open their edit dialog.
  const openEntry = (entry: LedgerEntry) => {
    if (!entities) return;
    if (entry.type === "expense" || entry.type === "recurring_expense") {
      const expense = entities.expenses.find((x) => x.id === entry.id);
      if (expense) openCreate({ kind: "expense", expense });
    } else if (entry.type === "income") {
      const income = entities.incomes.find((x) => x.id === entry.id);
      if (income) openCreate({ kind: "income", income });
    }
  };
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

  function onFiltersChange(changed: LedgerFilterState) {
    // A preset sets its own dates right away (the URL keeps only the preset).
    const next = changed.preset ? { ...changed, ...presetRange(changed.preset, today) } : changed;
    setFilters(next);
    const nextQuery = filtersToParams(next).toString();
    written.current.add(nextQuery);
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    setPage(0);
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        icon={navIcon("/ledger")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <ExportButton {...(isFiltering(filters) ? { entries: filtered } : {})} />
          </>
        }
      />

      {snapshotStatus.isError ? (
        <PageLoadError onRetry={snapshotStatus.refetch} />
      ) : !ledger || !lookups ? (
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
            <EmptyState icon={navIcon("/ledger")}>
              {ledger.length === 0 ? t("empty") : t("noMatches")}
            </EmptyState>
          ) : (
            <>
              <LedgerTable entries={visible} lookups={lookups} onOpen={openEntry} />
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
