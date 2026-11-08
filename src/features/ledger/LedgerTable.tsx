"use client";

/**
 * One page of ledger entries (T125): date, movement, category, account and signed amount. Below `md` the entries are
 * stacked cards (spec 003, FR-023); from `md` up, a table.
 * Spec 004: decorative icons next to the movement type, the category (subcategory → category →
 * generic) and the account kind. They are aria-hidden: the text is unchanged.
 */
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { AccountMark } from "@/components/icons/AccountMark";
import { LEDGER_TYPE_ICONS } from "@/components/icons/domain-icons";
import { Money } from "@/components/money/Money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { taxonomyIconFor, type ResolvedTaxonomyIcon } from "@/domain/icons";
import type { Account, LedgerEntry } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { selectLocale, usePreferences } from "@/store/preferences";
import type { LedgerLookups } from "./hooks";

interface Props {
  entries: readonly LedgerEntry[];
  lookups: LedgerLookups;
  /** Opens the entry's edit dialog (spec 009, FR-023). */
  onOpen?: (entry: LedgerEntry) => void;
}

interface Labelled {
  text: string;
  icon: ResolvedTaxonomyIcon | LucideIcon | null;
  /** An account shows its bank's mark instead of `icon`. */
  account?: Account;
}

/** Text with its decorative icon in front (an account mark, a taxonomy key or a Lucide icon). */
function WithIcon({
  icon,
  account,
  children,
}: {
  icon: Labelled["icon"];
  account?: Account | undefined;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {account ? (
        <AccountMark account={account} className="size-3.5" />
      ) : typeof icon === "string" ? (
        <CategoryIcon icon={icon} className="size-3.5" />
      ) : icon ? (
        <IconGlyph icon={icon} />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function IconGlyph({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" focusable="false" className="size-3.5 shrink-0" />;
}

/** Rows that open an edit dialog (spec 009, FR-023): expenses (manual or recurring) and incomes. */
const EDITABLE: ReadonlySet<LedgerEntry["type"]> = new Set([
  "expense",
  "recurring_expense",
  "income",
]);

export function LedgerTable({ entries, lookups, onOpen }: Props) {
  const t = useTranslations("ledger");
  const tc = useTranslations("expenses");
  const locale = usePreferences(selectLocale);
  const nameOf = useTaxonomyName();

  const subcategoryOf = (e: LedgerEntry): Labelled | null => {
    const sub = e.subcategoryId
      ? lookups.subcategories.find((x) => x.id === e.subcategoryId)
      : null;
    if (!sub) return null;
    const parent = lookups.categories.find((c) => c.id === sub.categoryId);
    return {
      text: parent ? `${nameOf(parent)} · ${nameOf(sub)}` : nameOf(sub),
      icon: taxonomyIconFor(sub.id, lookups),
    };
  };
  const accountOf = (e: LedgerEntry): Labelled | null => {
    const account = e.accountId ? lookups.accounts.find((a) => a.id === e.accountId) : null;
    return account?.name ? { text: account.name, icon: null, account } : null;
  };

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden" aria-label={t("movement")}>
        {entries.map((e) => {
          const category = subcategoryOf(e);
          const account = accountOf(e);
          const TypeIcon = LEDGER_TYPE_ICONS[e.type];
          return (
            <li
              key={`${e.type}:${e.id}`}
              data-testid="ledger-card"
              data-type={e.type}
              data-editable={EDITABLE.has(e.type) || undefined}
              className="relative flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
            >
              {onOpen && EDITABLE.has(e.type) && (
                <button
                  type="button"
                  className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={tc("openEdit", { name: e.description || t(`types.${e.type}`) })}
                  onClick={() => onOpen(e)}
                />
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="flex min-w-0 items-center gap-1.5 font-medium">
                  <TypeIcon
                    aria-hidden="true"
                    focusable="false"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate">{e.description || t(`types.${e.type}`)}</span>
                </p>
                <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  {e.description && <span>{t(`types.${e.type}`)}</span>}
                  {category && <WithIcon icon={category.icon}>{category.text}</WithIcon>}
                  {account && (
                    <WithIcon icon={account.icon} account={account.account}>
                      {account.text}
                    </WithIcon>
                  )}
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
      <LedgerRows
        entries={entries}
        subcategoryOf={subcategoryOf}
        accountOf={accountOf}
        {...(onOpen ? { onOpen } : {})}
      />
    </>
  );
}

function LedgerRows({
  entries,
  subcategoryOf,
  accountOf,
  onOpen,
}: {
  entries: readonly LedgerEntry[];
  subcategoryOf: (e: LedgerEntry) => Labelled | null;
  accountOf: (e: LedgerEntry) => Labelled | null;
  onOpen?: (entry: LedgerEntry) => void;
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
          const TypeIcon = LEDGER_TYPE_ICONS[e.type];
          return (
            <TableRow
              key={`${e.type}:${e.id}`}
              data-testid="ledger-row"
              data-type={e.type}
              data-editable={EDITABLE.has(e.type) || undefined}
            >
              <TableCell className="align-top text-muted-foreground tabular-nums">
                {formatDate(e.occurredOn, locale)}
              </TableCell>
              <TableCell className="min-w-40 align-top whitespace-normal">
                <p className="flex items-center gap-1.5 font-medium">
                  <TypeIcon
                    aria-hidden="true"
                    focusable="false"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  {onOpen && EDITABLE.has(e.type) ? (
                    <button
                      type="button"
                      className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() => onOpen(e)}
                      data-testid="ledger-open"
                    >
                      {e.description || t(`types.${e.type}`)}
                    </button>
                  ) : (
                    e.description || t(`types.${e.type}`)
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  {e.description && <span>{t(`types.${e.type}`)}</span>}
                </p>
              </TableCell>
              <TableCell className="hidden max-w-48 align-top text-muted-foreground md:table-cell">
                {category && <WithIcon icon={category.icon}>{category.text}</WithIcon>}
              </TableCell>
              <TableCell className="hidden max-w-40 align-top text-muted-foreground md:table-cell">
                {account && (
                  <WithIcon icon={account.icon} account={account.account}>
                    {account.text}
                  </WithIcon>
                )}
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
