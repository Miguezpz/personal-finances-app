"use client";

/**
 * Expenses (T092): spending by payment method, card statements, and the expenses and card payments
 * of a quincena, newest first. Automatic (recurring) charges are labelled; third-party MSI charges
 * never appear here — they aren't personal expenses (FR-020).
 *
 * Spec 009: the quincena is chosen in the header and drives the summary and the list (FR-019);
 * chips filter by bucket and payment method (FR-020); quincena and filters live in the URL, so the
 * Dashboard can link here filtered and a reload keeps them; rows are grouped by day (FR-016); on a
 * phone a row opens its edit dialog — delete is inside it — and on desktop the row's actions show
 * on hover or focus (FR-015); deleting has Undo instead of a confirmation (FR-009). Quick
 * expense templates are managed in Settings › Quick expenses (FR-029).
 */
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageLoadError } from "@/components/data/PageQueryState";
import { AccountMark } from "@/components/icons/AccountMark";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { BUCKET_ICONS } from "@/components/icons/domain-icons";
import { navIcon } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/PageHeader";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSnapshot, useSnapshotStatus } from "@/data/useFinanceSnapshot";
import { groupByDay } from "@/domain/day-groups";
import { taxonomyIconFor } from "@/domain/icons";
import { negateCents } from "@/domain/money";
import { periodFromKey, periodOf } from "@/domain/periods";
import type {
  CardPayment,
  Expense,
  FinanceSnapshot,
  IsoDate,
  Period,
  PeriodKey,
  SpendBucket,
} from "@/domain/types";
import { groupPaymentAccounts } from "@/features/settings/accounts/PaymentAccountOptions";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { useDeferredDelete } from "@/features/shared/use-deferred-delete";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { selectLocale, usePreferences } from "@/store/preferences";
import { openCreate } from "@/store/ui";
import { CardDebtSummary } from "./CardDebtSummary";
import { PeriodNavigator, SpendingByMethod } from "./SpendingByMethod";

const PAGE = 50;
const BUCKETS: readonly SpendBucket[] = ["needs", "wants"];
const PERIOD_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])-[12]$/;
const NO_METHOD = "none";

type Row =
  | { kind: "expense"; date: IsoDate; item: Expense }
  | { kind: "payment"; date: IsoDate; item: CardPayment };

const selectData = (s: FinanceSnapshot) => s;

/** Quincena and filters from the URL; anything invalid falls back to the default. */
function useExpenseFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useToday();
  const current = periodOf(today);
  const rawPeriod = params.get("periodo");
  const period: Period =
    rawPeriod && PERIOD_KEY_RE.test(rawPeriod) && rawPeriod <= current.key
      ? periodFromKey(rawPeriod as PeriodKey)
      : current;
  const rawBucket = params.get("bucket");
  const bucket = BUCKETS.find((b) => b === rawBucket) ?? null;
  const method = params.get("metodo");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return {
    period,
    bucket,
    method,
    setPeriod: (p: Period) => update({ periodo: p.key === current.key ? null : p.key }),
    setBucket: (b: SpendBucket | null) => update({ bucket: b }),
    setMethod: (m: string | null) => update({ metodo: m }),
    clear: () => update({ bucket: null, metodo: null }),
  };
}

export function ExpensesPage() {
  const t = useTranslations("expenses");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const snapshotStatus = useSnapshotStatus();
  const locale = usePreferences(selectLocale);
  const nameOf = useTaxonomyName();
  const today = useToday();
  const { data } = useFinanceSnapshot(selectData);
  const { remove } = useDeferredDelete();
  const filters = useExpenseFilters();
  const { period, bucket, method } = filters;
  const [visible, setVisible] = useState(PAGE);

  const inPeriod = useMemo<Row[]>(() => {
    if (!data) return [];
    const within = (date: IsoDate) => date >= period.start && date <= period.end;
    return [
      ...data.expenses
        .filter((e) => within(e.spentOn))
        .map((item): Row => ({ kind: "expense", date: item.spentOn, item })),
      ...data.cardPayments
        .filter((p) => within(p.paidOn))
        .map((item): Row => ({ kind: "payment", date: item.paidOn, item })),
    ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [data, period]);

  // Method chips: one per account used by an expense of the quincena (summary order) + "none".
  const methodOptions = useMemo(() => {
    if (!data) return { accounts: [], unspecified: false };
    const used = new Set(
      inPeriod.flatMap((r) =>
        r.kind === "expense" && r.item.paymentAccountId ? [r.item.paymentAccountId] : [],
      ),
    );
    const accounts = groupPaymentAccounts(
      data.accounts.filter((a) => used.has(a.id)),
      locale,
    ).flatMap((g) => g.accounts);
    const unspecified = inPeriod.some((r) => r.kind === "expense" && !r.item.paymentAccountId);
    return { accounts, unspecified };
  }, [data, inPeriod, locale]);

  const filtering = bucket !== null || method !== null;
  const rows = useMemo(
    () =>
      filtering
        ? inPeriod.filter(
            (r) =>
              r.kind === "expense" &&
              (bucket === null || r.item.bucket === bucket) &&
              (method === null ||
                (method === NO_METHOD
                  ? r.item.paymentAccountId === null
                  : r.item.paymentAccountId === method)),
          )
        : inPeriod,
    [inPeriod, filtering, bucket, method],
  );
  const groups = useMemo(() => groupByDay(rows.slice(0, visible), today), [rows, visible, today]);

  const subName = (id: string) => {
    const sub = data?.subcategories.find((x) => x.id === id);
    return sub ? nameOf(sub) : "";
  };
  const accountName = (id: string | null) => data?.accounts.find((a) => a.id === id)?.name ?? null;
  const accountLabel = (id: string | null) => {
    const account = data?.accounts.find((a) => a.id === id);
    if (!account?.name) return null;
    return (
      <span className="inline-flex items-center gap-1">
        <AccountMark account={account} className="size-3.5" />
        {account.name}
      </span>
    );
  };
  const rowTitle = (row: Row) =>
    row.kind === "expense"
      ? (row.item.note ?? subName(row.item.subcategoryId))
      : t("cardPaymentLabel", { card: accountName(row.item.cardAccountId) ?? "" });

  // Spec 009 (FR-009): deleted at once, with Undo instead of a confirmation.
  const deleteRow = (row: Row) =>
    remove({
      kind: row.kind === "expense" ? "expense" : "card-payment",
      id: row.item.id,
      label: tc("deletedItem", { name: rowTitle(row) }),
    });
  const dayLabel = (label: "today" | "yesterday" | "date", date: IsoDate) =>
    label === "today"
      ? tc("today")
      : label === "yesterday"
        ? tc("yesterday")
        : formatDate(date, locale, "day");

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        icon={navIcon("/expenses")}
        title={t("title")}
        description={t("description")}
        actions={<PeriodNavigator period={period} onChange={filters.setPeriod} />}
      />

      <SpendingByMethod period={period} />

      <CardDebtSummary />

      <section aria-labelledby="movements" className="flex flex-col gap-3">
        <h2 id="movements" className="text-lg font-semibold tracking-tight">
          {t("movements")}
        </h2>

        {data && inPeriod.length > 0 && (
          <div
            role="group"
            aria-label={t("filtersLabel")}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5"
            data-testid="expense-filters"
          >
            {BUCKETS.map((b) => {
              const Icon = BUCKET_ICONS[b];
              return (
                <Chip
                  key={b}
                  pressed={bucket === b}
                  onClick={() => filters.setBucket(bucket === b ? null : b)}
                  data-testid={`filter-bucket-${b}`}
                >
                  <Icon aria-hidden="true" />
                  {tb(b)}
                </Chip>
              );
            })}
            {methodOptions.accounts.map((a) => (
              <Chip
                key={a.id}
                pressed={method === a.id}
                onClick={() => filters.setMethod(method === a.id ? null : a.id)}
                data-testid={`filter-method-${a.id}`}
              >
                <AccountMark account={a} className="size-3.5" />
                {a.name}
              </Chip>
            ))}
            {methodOptions.unspecified && (
              <Chip
                pressed={method === NO_METHOD}
                onClick={() => filters.setMethod(method === NO_METHOD ? null : NO_METHOD)}
                data-testid={`filter-method-${NO_METHOD}`}
              >
                {t("filterNoMethod")}
              </Chip>
            )}
            {filtering && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 pointer-coarse:min-h-11"
                onClick={filters.clear}
                data-testid="clear-filters"
              >
                {t("clearFilters")}
              </Button>
            )}
          </div>
        )}

        {snapshotStatus.isError ? (
          <PageLoadError onRetry={snapshotStatus.refetch} />
        ) : !data ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          filtering ? (
            <EmptyState
              icon={navIcon("/expenses")}
              action={
                <Button variant="outline" size="sm" onClick={filters.clear}>
                  {t("clearFilters")}
                </Button>
              }
            >
              {t("noMatches")}
            </EmptyState>
          ) : (
            <EmptyState
              icon={navIcon("/expenses")}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCreate({ kind: "expense" })}
                  data-testid="empty-add-expense"
                >
                  <Plus aria-hidden="true" />
                  {t("addTitle")}
                </Button>
              }
            >
              {t("empty")}
            </EmptyState>
          )
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <section
                  key={group.date}
                  aria-label={dayLabel(group.label, group.date)}
                  data-testid="day-group"
                  data-label={group.label}
                  className="flex flex-col gap-1.5"
                >
                  <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {dayLabel(group.label, group.date)}
                  </h3>
                  <ul className="divide-y rounded-lg border">
                    {group.rows.map((row) => (
                      <li
                        key={`${row.kind}-${row.item.id}`}
                        data-testid={row.kind === "expense" ? "expense-row" : "payment-row"}
                        className="group/row relative grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 text-sm"
                      >
                        {row.kind === "expense" && (
                          // Mobile: the whole row opens its edit dialog (delete is inside it).
                          <button
                            type="button"
                            className="absolute inset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset md:hidden"
                            aria-label={t("openEdit", { name: rowTitle(row) })}
                            data-testid="expense-row-open"
                            onClick={() => openCreate({ kind: "expense", expense: row.item })}
                          />
                        )}
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{rowTitle(row)}</span>
                          {row.kind === "expense" ? (
                            <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                              <CategoryIcon
                                icon={taxonomyIconFor(row.item.subcategoryId, data)}
                                className="size-3.5"
                              />
                              {subName(row.item.subcategoryId)}
                              <BucketBadge bucket={row.item.bucket} label={tb(row.item.bucket)} />
                              {row.item.origin === "recurring" && (
                                <Badge variant="secondary">
                                  <Repeat aria-hidden="true" focusable="false" />
                                  {t("automatic")}
                                </Badge>
                              )}
                              {accountName(row.item.paymentAccountId) && (
                                <>· {accountLabel(row.item.paymentAccountId)}</>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {row.item.note ?? t("debtSettlement")}
                              {accountName(row.item.fromAccountId) && (
                                <> · {accountLabel(row.item.fromAccountId)}</>
                              )}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center justify-end gap-1">
                          <Money
                            cents={negateCents(row.item.amount)}
                            signed
                            className="mr-1 font-medium whitespace-nowrap"
                          />
                          <span
                            className={cn(
                              "relative flex items-center gap-1 transition-opacity duration-fast",
                              // Desktop: the actions show on hover or keyboard focus.
                              "md:opacity-0 md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100",
                              // Mobile: an expense's actions live in its edit dialog.
                              row.kind === "expense" && "max-md:hidden",
                            )}
                          >
                            {row.kind === "expense" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("edit")}
                                onClick={() => openCreate({ kind: "expense", expense: row.item })}
                              >
                                <Pencil aria-hidden="true" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("delete")}
                              onClick={() => deleteRow(row)}
                              data-testid="row-delete"
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {rows.length > visible && (
              <Button
                variant="outline"
                className="self-center"
                onClick={() => setVisible((v) => v + PAGE)}
              >
                {t("showMore")}
              </Button>
            )}
          </>
        )}
      </section>
    </section>
  );
}

function BucketBadge({ bucket, label }: { bucket: Expense["bucket"]; label: string }) {
  const Icon = BUCKET_ICONS[bucket];
  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" focusable="false" />
      {label}
    </Badge>
  );
}
