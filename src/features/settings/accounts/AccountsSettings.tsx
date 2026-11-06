"use client";

/**
 * Account catalog (T122, FR-039): create, edit, archive and restore accounts and cards. Archiving
 * keeps the history; a card with pending third-party installments can't be archived (CONFLICT).
 */
import { Archive, ArchiveRestore, Landmark, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotifiedGlobally, isProviderError } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { Account, FinanceSnapshot } from "@/domain/types";
import { SettingsHeader } from "../SettingsHeader";
import { AccountForm } from "./AccountForm";
import { hasPendingInstallments, useAccounts, useArchiveAccount, useRestoreAccount } from "./hooks";
import { ACCOUNT_KINDS } from "./schema";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountMark } from "@/components/icons/AccountMark";
import { ACCOUNT_KIND_ICONS } from "@/components/icons/domain-icons";

const selectMsi = (s: FinanceSnapshot) => ({
  receivables: s.receivables,
  installments: s.installments,
});

export function AccountsSettings() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { data: accounts } = useAccounts();
  const { data: msi } = useFinanceSnapshot(selectMsi);
  const archive = useArchiveAccount();
  const restore = useRestoreAccount();
  const [form, setForm] = useState<{ open: boolean; account: Account | null }>({
    open: false,
    account: null,
  });

  const onError = (e: Error) => {
    if (isNotifiedGlobally(e)) return;
    toast.error(isProviderError(e, "CONFLICT") ? t("archiveBlocked") : tc("unexpectedError"));
  };

  function onArchive(a: Account) {
    // Explain up front (the provider rejects it with CONFLICT anyway).
    if (msi && a.kind === "credit_card" && hasPendingInstallments(msi, a.id)) {
      toast.error(t("archiveBlocked"));
      return;
    }
    archive.mutate(a.id, { onSuccess: () => toast.success(t("accountArchived")), onError });
  }

  const sorted = [...(accounts ?? [])].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      ACCOUNT_KINDS.indexOf(a.kind) - ACCOUNT_KINDS.indexOf(b.kind) ||
      a.name.localeCompare(b.name),
  );

  return (
    <section className="flex flex-col gap-6">
      <SettingsHeader
        title={t("accountsTitle")}
        description={t("accountsDescription")}
        action={
          <Button onClick={() => setForm({ open: true, account: null })} data-testid="add-account">
            <Plus aria-hidden="true" />
            {t("addAccount")}
          </Button>
        }
      />

      {!accounts ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={Landmark}>{t("noAccounts")}</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sorted.map((a) => (
            <li key={a.id}>
              <Card
                data-testid="account-card"
                data-id={a.id}
                data-archived={a.archived}
                className={a.archived ? "opacity-70" : undefined}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <AccountMark account={a} className="size-6" />
                      <span className="truncate">{a.name}</span>
                      <AccountKindBadge kind={a.kind} label={t(`kinds.${a.kind}`)} />
                      {a.archived && <Badge variant="secondary">{t("archivedBadge")}</Badge>}
                    </CardTitle>
                    {a.institution && (
                      <p className="text-sm text-muted-foreground">{a.institution}</p>
                    )}
                    {a.kind === "credit_card" &&
                      a.cutOffDay !== null &&
                      a.paymentDueOffsetDays !== null && (
                        <p className="text-sm text-muted-foreground">
                          {t("cardTerms", { day: a.cutOffDay, offset: a.paymentDueOffsetDays })}
                        </p>
                      )}
                  </div>
                  {a.openingBalance !== 0 && (
                    <Money cents={a.openingBalance} className="text-sm text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({ open: true, account: a })}
                    data-testid="edit-account"
                  >
                    <Pencil aria-hidden="true" />
                    {t("edit")}
                  </Button>
                  {a.archived ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        restore.mutate(a.id, {
                          onSuccess: () => toast.success(t("accountRestored")),
                          onError,
                        })
                      }
                    >
                      <ArchiveRestore aria-hidden="true" />
                      {t("restore")}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onArchive(a)}
                      data-testid="archive-account"
                    >
                      <Archive aria-hidden="true" />
                      {t("archive")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {form.open && (
        <AccountForm
          key={form.account?.id ?? "new"}
          open={form.open}
          account={form.account}
          takenNames={(accounts ?? []).filter((a) => a.id !== form.account?.id).map((a) => a.name)}
          onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        />
      )}
    </section>
  );
}

function AccountKindBadge({ kind, label }: { kind: Account["kind"]; label: string }) {
  const Icon = ACCOUNT_KIND_ICONS[kind];
  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" focusable="false" />
      {label}
    </Badge>
  );
}
