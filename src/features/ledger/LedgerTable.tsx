"use client";

/**
 * One page of ledger entries (T125): date, movement, category, account and signed amount. Below `md` the entries are
 * stacked cards (spec 003, FR-023); from `md` up, a table.
 */
import { useTranslations } from "next-intl";
import { Money } from "@/components/money/Money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LedgerEntry } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { selectLocale, usePreferences } from "@/store/preferences";
import type { LedgerLookups } from "./hooks";

interface Props {
  entries: readonly LedgerEntry[];
  lookups: LedgerLookups;
}

export function LedgerTable({ entries, lookups }: Props) {
  const t = useTranslations("ledger");
  const locale = usePreferences(selectLocale);
  const nameOf = useTaxonomyName();

  const subcategoryOf = (e: LedgerEntry) => {
    const sub = e.subcategoryId
      ? lookups.subcategories.find((x) => x.id === e.subcategoryId)
      : null;
    if (!sub) return null;
    const parent = lookups.categories.find((c) => c.id === sub.categoryId);
    return parent ? `${nameOf(parent)} · ${nameOf(sub)}` : nameOf(sub);
  };
  const accountOf = (e: LedgerEntry) =>
    (e.accountId && lookups.accounts.find((a) => a.id === e.accountId)?.name) || null;

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden" aria-label={t("movement")}>
        {entries.map((e) => {
          const category = subcategoryOf(e);
          const account = accountOf(e);
          return (
            <li
              key={`${e.type}:${e.id}`}
              data-testid="ledger-card"
              data-type={e.type}
              className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate font-medium">{e.description || t(`types.${e.type}`)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[e.description ? t(`types.${e.type}`) : null, category, account]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(e.occurredOn, locale)}
                </p>
              </div>
              <span className={cn("shrink-0 font-medium", e.amount > 0 && "text-success")}>
                <Money cents={e.amount} signed={e.amount > 0} />
              </span>
            </li>
          );
        })}
      </ul>
      <LedgerRows entries={entries} subcategoryOf={subcategoryOf} accountOf={accountOf} />
    </>
  );
}

function LedgerRows({
  entries,
  subcategoryOf,
  accountOf,
}: {
  entries: readonly LedgerEntry[];
  subcategoryOf: (e: LedgerEntry) => string | null;
  accountOf: (e: LedgerEntry) => string | null;
}) {
  const t = useTranslations("ledger");
  const locale = usePreferences(selectLocale);
  return (
    <Table data-testid="ledger-table" className="hidden md:table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">{t("date")}</TableHead>
          <TableHead>{t("movement")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("category")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("account")}</TableHead>
          <TableHead className="text-right">{t("amount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => {
          const category = subcategoryOf(e);
          const account = accountOf(e);
          return (
            <TableRow key={`${e.type}:${e.id}`} data-testid="ledger-row" data-type={e.type}>
              <TableCell className="align-top text-muted-foreground tabular-nums">
                {formatDate(e.occurredOn, locale)}
              </TableCell>
              <TableCell className="min-w-40 align-top whitespace-normal">
                <p className="font-medium">{e.description || t(`types.${e.type}`)}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  {e.description && <span>{t(`types.${e.type}`)}</span>}
                  {(category || account) && (
                    <span className="md:hidden">
                      {[category, account].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </p>
              </TableCell>
              <TableCell className="hidden max-w-48 truncate align-top text-muted-foreground md:table-cell">
                {category}
              </TableCell>
              <TableCell className="hidden max-w-40 truncate align-top text-muted-foreground md:table-cell">
                {account}
              </TableCell>
              <TableCell
                className={cn("text-right align-top font-medium", e.amount > 0 && "text-success")}
              >
                <Money cents={e.amount} signed={e.amount > 0} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
